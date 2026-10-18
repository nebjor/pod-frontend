import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';
import { FilamentCode, QualityCode, QuoteResponse } from '../quote/quote.models';
import { QuoteService, describeQuoteError } from '../quote/quote.service';

type UploadFormat = 'stl' | '3mf';
type QuoteState = 'idle' | 'loading' | 'ready' | 'error';
type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface QuoteJob {
    file: File;
    filament: FilamentCode;
    quality: QualityCode;
    quantity: number;
}

interface QuoteOutcome {
    quote: QuoteResponse | null;
    error: string;
}

export const MAX_ORDER_QUANTITY = 20;

/** Options the backend currently slices with (Bambu Lab A1 profiles). */
export const FILAMENT_OPTIONS: ReadonlyArray<{ code: FilamentCode; label: string }> = [
    { code: 'PLA', label: 'PLA' },
    { code: 'PETG', label: 'PETG' }
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
    private readonly destroyRef = inject(DestroyRef);
    private readonly quoteJobs = new Subject<QuoteJob>();

    readonly filamentOptions = FILAMENT_OPTIONS;
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
        quality: new FormControl<QualityCode>('medium', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl(1, {
            nonNullable: true,
            validators: [Validators.required, Validators.min(1), Validators.max(MAX_ORDER_QUANTITY)]
        })
    });

    private readonly formStatus = toSignal(this.orderForm.statusChanges, { initialValue: this.orderForm.status });

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
                debounceTime(250),
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

    /** Sends the current file and configuration to the backend slicer. Safe to call repeatedly. */
    requestQuote() {
        const file = this.selectedFile();
        if (!file || this.orderForm.invalid) {
            return;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        this.quoteState.set('loading');
        this.quoteError.set('');
        this.quoteJobs.next({ file, filament, quality, quantity: Number(quantity) });
    }

    onAddToCartAndUploadAnother() {
        if (!this.canSubmitOrder()) {
            return;
        }

        this.cartNotice.set('Modell wurde zum lokalen Warenkorb hinzugefuegt. Lade jetzt ein weiteres Modell hoch.');
        this.resetModel();
    }

    onDirectCheckout() {
        if (!this.canSubmitOrder()) {
            return;
        }

        this.router.navigate(['/checkout'], { state: { quote: this.quote() } });
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
    }

    private releaseModelUrl() {
        const url = this.modelUrl();
        if (url) {
            URL.revokeObjectURL(url);
            this.modelUrl.set(undefined);
        }
    }
}
