import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    afterNextRender,
    computed,
    effect,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';
import { ColorOption, FilamentCode, FilamentOption, QualityCode, QuoteResponse } from '../quote/quote.models';
import { QuoteService, describeQuoteError } from '../quote/quote.service';

type UploadFormat = 'stl' | '3mf';
type QuoteState = 'idle' | 'loading' | 'ready' | 'error';
type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface QuoteJob {
    file: File;
    filament: FilamentCode;
    color: string;
    quality: QualityCode;
    quantity: number;
}

interface QuoteOutcome {
    quote: QuoteResponse | null;
    error: string;
}

export const MAX_ORDER_QUANTITY = 20;

/**
 * Every slicer run costs seconds of CPU and counts against the client's rate limit, so the
 * form waits until the user stops changing values before it asks the backend.
 */
export const QUOTE_DEBOUNCE_MS = 800;

/**
 * Used until the backend catalogue has loaded, and when it cannot be reached. The backend
 * validates the final selection either way.
 */
export const FALLBACK_FILAMENTS: ReadonlyArray<FilamentOption> = [
    {
        code: 'PLA',
        label: 'PLA',
        profileName: 'Bambu PLA Basic @BBL A1',
        colors: [
            { code: 'black', label: 'Charcoal Black (matt)', hex: '#2b2b2b' },
            { code: 'white', label: 'Cotton White (matt)', hex: '#f1ede3' },
            { code: 'gold', label: 'Gold', hex: '#d4a017' },
            { code: 'green', label: 'Green', hex: '#1f9d4a' },
            { code: 'red', label: 'Red', hex: '#d62828' },
            { code: 'blue', label: 'Blue', hex: '#1f4fd6' },
            { code: 'silk-neon-city', label: 'Silk Neon City (pink / violet / blue)', hex: '#c94fb4' },
            { code: 'silk-blue-hawaii', label: 'Silk Blue Hawaii (cyan / green)', hex: '#35b8c6' }
        ]
    },
    {
        code: 'PETG',
        label: 'PETG',
        profileName: 'PolyLite PETG @BBL A1',
        colors: [
            { code: 'black', label: 'Black', hex: '#1f1f1f' },
            { code: 'white', label: 'White', hex: '#f2f2f2' }
        ]
    },
    {
        code: 'PCTG',
        label: 'PCTG (transparent)',
        profileName: 'Generic PCTG @BBL A1',
        colors: [{ code: 'transparent', label: 'Transparent', hex: '#dde8ef' }]
    }
];

export const QUALITY_OPTIONS: ReadonlyArray<{ code: QualityCode; label: string }> = [
    { code: 'coarse', label: 'Low (0.24 mm)' },
    { code: 'medium', label: 'Middle (0.20 mm)' },
    { code: 'high', label: 'High (0.12 mm)' }
];

export function formatPrintDuration(totalSeconds: number): string {
    const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    }

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

@Component({
    selector: 'app-upload',
    imports: [ReactiveFormsModule, DecimalPipe, ModelViewerComponent],
    templateUrl: './upload.component.html',
    styleUrl: './upload.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadComponent {
    private readonly router = inject(Router);
    private readonly quoteService = inject(QuoteService);
    private readonly cart = inject(CartService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly quoteJobs = new Subject<QuoteJob>();

    /** Key of the last job sent; colour is excluded because it never changes the slice. */
    private lastRequestedKey = '';

    readonly filamentOptions = signal<ReadonlyArray<FilamentOption>>(FALLBACK_FILAMENTS);
    readonly qualityOptions = QUALITY_OPTIONS;
    readonly maxQuantity = MAX_ORDER_QUANTITY;

    readonly isDragging = signal(false);
    readonly isModelLoading = signal(false);
    readonly modelLoadProgress = signal(0);
    readonly errorMessage = signal('');
    readonly cartNotice = signal('');
    readonly selectedFile = signal<File | null>(null);
    readonly modelUrl = signal<string | undefined>(undefined);
    readonly modelFormat = signal<UploadFormat | undefined>(undefined);

    readonly quote = signal<QuoteResponse | null>(null);
    readonly quoteState = signal<QuoteState>('idle');
    readonly quoteError = signal('');

    readonly orderForm = new FormGroup({
        filament: new FormControl<FilamentCode>('PLA', { nonNullable: true, validators: [Validators.required] }),
        color: new FormControl('black', { nonNullable: true, validators: [Validators.required] }),
        quality: new FormControl<QualityCode>('medium', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl(1, {
            nonNullable: true,
            validators: [Validators.required, Validators.min(1), Validators.max(MAX_ORDER_QUANTITY)]
        })
    });

    private readonly formStatus = toSignal(this.orderForm.statusChanges, { initialValue: this.orderForm.status });
    readonly selectedFilament = toSignal(this.orderForm.controls.filament.valueChanges, {
        initialValue: this.orderForm.controls.filament.value
    });
    readonly selectedColorCode = toSignal(this.orderForm.controls.color.valueChanges, {
        initialValue: this.orderForm.controls.color.value
    });

    /** Colours stocked for the selected filament. */
    readonly availableColors = computed<ReadonlyArray<ColorOption>>(
        () => this.filamentOptions().find((option) => option.code === this.selectedFilament())?.colors ?? []
    );
    readonly selectedColor = computed<ColorOption | undefined>(() => {
        const colors = this.availableColors();
        return colors.find((color) => color.code === this.selectedColorCode()) ?? colors[0];
    });

    readonly selectedFileName = computed(() => this.selectedFile()?.name ?? '');
    readonly selectedFileSizeMb = computed(() => {
        const file = this.selectedFile();
        return file ? Math.round((file.size / (1024 * 1024)) * 100) / 100 : 0;
    });
    readonly unitPrintTimeLabel = computed(() => formatPrintDuration(this.quote()?.printTimeSeconds ?? 0));
    readonly totalPrintTimeLabel = computed(() => formatPrintDuration(this.quote()?.totalPrintTimeSeconds ?? 0));
    readonly canSubmitOrder = computed(
        () => this.quoteState() === 'ready' && this.quote() !== null && this.formStatus() === 'VALID'
    );

    constructor() {
        this.quoteJobs
            .pipe(
                debounceTime(QUOTE_DEBOUNCE_MS),
                switchMap((job) =>
                    this.quoteService.requestQuote(job.file, job).pipe(
                        map((quote): QuoteOutcome => ({ quote, error: '' })),
                        catchError((error: unknown) => of<QuoteOutcome>({ quote: null, error: describeQuoteError(error) }))
                    )
                ),
                takeUntilDestroyed()
            )
            .subscribe((outcome) => this.applyQuoteOutcome(outcome));

        this.orderForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.requestQuote());
        this.destroyRef.onDestroy(() => this.releaseModelUrl());

        // A filament switch may drop the chosen colour; fall back to the first stocked one.
        effect(() => {
            const colors = this.availableColors();
            const current = this.selectedColorCode();
            if (colors.length > 0 && !colors.some((color) => color.code === current)) {
                this.orderForm.controls.color.setValue(colors[0].code);
            }
        });

        // The catalogue is fetched in the browser only; the page is prerendered on the server.
        afterNextRender(() => {
            this.quoteService
                .loadOptions()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (options) => {
                        if (options.filaments.length > 0) {
                            this.filamentOptions.set(options.filaments);
                        }
                    },
                    error: () => {
                        // Keep the fallback list; the backend validates the final selection anyway.
                    }
                });
        });
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(false);

        const file = event.dataTransfer?.files?.item(0);
        if (file) {
            this.handleFile(file);
        }
    }

    onFileInputChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.item(0);

        if (file) {
            this.handleFile(file);
        }

        input.value = '';
    }

    onModelLoadStateChange(state: ModelLoadState) {
        if (state === 'loading') {
            this.isModelLoading.set(true);
            return;
        }

        this.isModelLoading.set(false);

        if (state === 'error') {
            this.errorMessage.set('Modell konnte nicht geladen werden. Bitte pruefe das Dateiformat.');
        }
    }

    onModelLoadProgress(progress: number) {
        this.modelLoadProgress.set(progress);
    }

    /**
     * Sends the current file and configuration to the backend slicer. Jobs whose slice-relevant
     * values are unchanged are dropped unless {@code force} is set, which the retry button uses.
     */
    requestQuote(force = false) {
        const file = this.selectedFile();
        if (!file || this.orderForm.invalid) {
            return;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        const key = `${file.name}|${file.size}|${file.lastModified}|${filament}|${quality}|${quantity}`;
        if (!force && key === this.lastRequestedKey) {
            return;
        }

        // Right after a filament switch the form may still hold a colour the new filament does
        // not come in; selectedColor() already falls back to a stocked one.
        const color = this.selectedColor()?.code ?? this.orderForm.controls.color.value;

        this.lastRequestedKey = key;
        this.quoteState.set('loading');
        this.quoteError.set('');
        this.quoteJobs.next({ file, filament, color, quality, quantity: Number(quantity) });
    }

    onAddToCartAndUploadAnother() {
        if (!this.putInCart()) {
            return;
        }

        this.cartNotice.set('Modell liegt im Warenkorb. Lade ein weiteres Modell hoch oder geh zur Kasse.');
        this.resetModel();
    }

    onDirectCheckout() {
        if (!this.putInCart()) {
            return;
        }

        this.router.navigate(['/checkout']);
    }

    /** Hands the configured model and its quote to the checkout; one item per order in v1. */
    private putInCart(): boolean {
        const file = this.selectedFile();
        const quote = this.quote();
        const color = this.selectedColor();
        if (!this.canSubmitOrder() || !file || !quote || !color) {
            return false;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        this.cart.set({ file, filament, color, quality, quantity: Number(quantity), quote });
        return true;
    }

    private handleFile(file: File) {
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension !== 'stl' && extension !== '3mf') {
            this.errorMessage.set('Nur STL oder 3MF Dateien sind erlaubt.');
            return;
        }

        this.errorMessage.set('');
        this.cartNotice.set('');
        this.resetModel();

        this.selectedFile.set(file);
        this.modelFormat.set(extension);
        this.modelLoadProgress.set(0);
        this.isModelLoading.set(true);
        this.modelUrl.set(URL.createObjectURL(file));

        this.requestQuote();
    }

    private applyQuoteOutcome(outcome: QuoteOutcome) {
        if (outcome.quote) {
            this.quote.set(outcome.quote);
            this.quoteError.set('');
            this.quoteState.set('ready');
            return;
        }

        this.quote.set(null);
        this.quoteError.set(outcome.error);
        this.quoteState.set('error');
    }

    private resetModel() {
        this.releaseModelUrl();
        this.selectedFile.set(null);
        this.modelFormat.set(undefined);
        this.quote.set(null);
        this.quoteError.set('');
        this.quoteState.set('idle');
        this.isModelLoading.set(false);
        this.modelLoadProgress.set(0);
        this.lastRequestedKey = '';
    }

    private releaseModelUrl() {
        const url = this.modelUrl();
        if (url) {
            URL.revokeObjectURL(url);
            this.modelUrl.set(undefined);
        }
    }
}
