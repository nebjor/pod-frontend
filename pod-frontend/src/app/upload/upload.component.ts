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
import { EMPTY, Subject, catchError, concatMap, debounceTime, from, map, of, switchMap, tap, timer } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';
import { ColorOption, FilamentOption, QualityOption, QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService, describeQuoteError } from '../quote/quote.service';

type UploadFormat = 'stl' | '3mf';
type QuoteState = 'idle' | 'loading' | 'ready' | 'error';
type CatalogState = 'loading' | 'ready' | 'error';
type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface QuoteJob {
    key: string;
    file: File;
    filament: string;
    color: string;
    quality: string;
    quantity: number;
}

interface QuoteOutcome {
    job: QuoteJob;
    quote: QuoteResponse | null;
    error: string;
}

/**
 * Every slicer run costs seconds of CPU and counts against the client's rate limit, so the
 * form waits until the user stops changing values before it asks the backend.
 */
export const QUOTE_DEBOUNCE_MS = 800;

/**
 * Once a quote is on screen the other filaments are fetched in the background, so switching
 * between them is instant. The pause keeps a user who is still changing quality or quantity
 * from triggering slices that are thrown away.
 */
export const PREFETCH_DELAY_MS = 1000;

/** Identifies a slice; colour is excluded because it never changes the result. */
function quoteKey(file: File, filament: string, quality: string, quantity: number): string {
    return `${file.name}|${file.size}|${file.lastModified}|${filament}|${quality}|${quantity}`;
}

/** Chosen when the catalogue arrives, if the backend offers it; otherwise the first tier. */
const PREFERRED_QUALITY = 'medium';

export function formatPrintDuration(totalSeconds: number): string {
    const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    }

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

/**
 * Upload, configure, quote. The catalogue (filaments, colours, qualities, quantity limit)
 * comes from the backend and nothing here is hard-coded: a new material in the backend
 * configuration shows up without a frontend release.
 */
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
    private readonly quoteJobs = new Subject<QuoteJob | null>();
    private readonly prefetchRuns = new Subject<QuoteJob | null>();

    /** Key of the last job sent or served from the cache. */
    private lastRequestedKey = '';
    /** Quotes already fetched for the selected file, by {@link quoteKey}; cleared with the file. */
    private readonly quoteCache = new Map<string, QuoteResponse>();

    readonly catalogState = signal<CatalogState>('loading');
    readonly filamentOptions = signal<ReadonlyArray<FilamentOption>>([]);
    readonly qualityOptions = signal<ReadonlyArray<QualityOption>>([]);
    readonly maxQuantity = signal(1);

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
        filament: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        color: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quality: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] })
    });

    private readonly formStatus = toSignal(this.orderForm.statusChanges, { initialValue: this.orderForm.status });
    readonly selectedFilament = toSignal(this.orderForm.controls.filament.valueChanges, {
        initialValue: this.orderForm.controls.filament.value
    });
    readonly selectedColorCode = toSignal(this.orderForm.controls.color.valueChanges, {
        initialValue: this.orderForm.controls.color.value
    });
    readonly selectedQualityCode = toSignal(this.orderForm.controls.quality.valueChanges, {
        initialValue: this.orderForm.controls.quality.value
    });

    readonly selectedFilamentOption = computed<FilamentOption | undefined>(() =>
        this.filamentOptions().find((option) => option.code === this.selectedFilament())
    );
    readonly selectedQualityOption = computed<QualityOption | undefined>(() =>
        this.qualityOptions().find((option) => option.code === this.selectedQualityCode())
    );

    /** Colours stocked for the selected filament. */
    readonly availableColors = computed<ReadonlyArray<ColorOption>>(() => this.selectedFilamentOption()?.colors ?? []);
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
                    job === null
                        ? EMPTY
                        : this.quoteService.requestQuote(job.file, {
                              filament: job.filament,
                              color: job.color,
                              quality: job.quality,
                              quantity: job.quantity
                          }).pipe(
                              map((quote): QuoteOutcome => ({ job, quote, error: '' })),
                              catchError((error: unknown) =>
                                  of<QuoteOutcome>({ job, quote: null, error: describeQuoteError(error) })
                              )
                          )
                ),
                takeUntilDestroyed()
            )
            .subscribe((outcome) => this.applyQuoteOutcome(outcome));

        this.prefetchRuns
            .pipe(
                switchMap((job) =>
                    job === null ? EMPTY : timer(PREFETCH_DELAY_MS).pipe(switchMap(() => this.prefetchOtherFilaments(job)))
                ),
                takeUntilDestroyed()
            )
            .subscribe();

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
        afterNextRender(() => this.loadCatalog());
    }

    /** Fetches what the backend sells right now; the retry button calls it again. */
    loadCatalog() {
        this.catalogState.set('loading');
        this.quoteService
            .loadOptions()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (options) => this.applyCatalog(options),
                error: () => this.catalogState.set('error')
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
     * Without a catalogue there is nothing valid to send; the job runs once it has arrived.
     */
    requestQuote(force = false) {
        const file = this.selectedFile();
        if (!file || this.catalogState() !== 'ready' || this.orderForm.invalid) {
            return;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        const key = quoteKey(file, filament, quality, Number(quantity));
        if (!force && key === this.lastRequestedKey) {
            return;
        }

        // Right after a filament switch the form may still hold a colour the new filament does
        // not come in; selectedColor() already falls back to a stocked one.
        const color = this.selectedColor()?.code ?? this.orderForm.controls.color.value;
        const job: QuoteJob = { key, file, filament, color, quality, quantity: Number(quantity) };

        this.lastRequestedKey = key;
        const cached = force ? undefined : this.quoteCache.get(key);
        if (cached) {
            // Served from the cache, and a slice still pending for an earlier choice is dropped.
            this.quoteJobs.next(null);
            this.applyQuoteOutcome({ job, quote: cached, error: '' });
            return;
        }

        this.quoteState.set('loading');
        this.quoteError.set('');
        this.quoteJobs.next(job);
    }

    /**
     * Fetches the quote of every other filament for the same quality and quantity, one after
     * the other so the slicer is not flooded. Best effort: a failure only means that filament
     * is sliced on demand when chosen. Cache hits on the backend do not count against the
     * rate limit, so repeating a prefetch after a quality change is cheap for the user.
     */
    private prefetchOtherFilaments(job: QuoteJob) {
        const others = this.filamentOptions().filter((option) => option.code !== job.filament);
        return from(others).pipe(
            concatMap((option) => {
                const key = quoteKey(job.file, option.code, job.quality, job.quantity);
                if (this.quoteCache.has(key)) {
                    return EMPTY;
                }
                const params = {
                    filament: option.code,
                    color: option.colors[0]?.code ?? '',
                    quality: job.quality,
                    quantity: job.quantity
                };
                return this.quoteService.requestQuote(job.file, params).pipe(
                    tap((quote) => this.quoteCache.set(key, quote)),
                    catchError(() => EMPTY)
                );
            })
        );
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

    private applyCatalog(options: QuoteOptions) {
        if (options.filaments.length === 0 || options.qualities.length === 0) {
            this.catalogState.set('error');
            return;
        }

        this.filamentOptions.set(options.filaments);
        this.qualityOptions.set(options.qualities);
        this.maxQuantity.set(options.maxQuantity);
        this.orderForm.controls.quantity.setValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(options.maxQuantity)
        ]);

        // Values are set with events so the signals derived from valueChanges follow; the
        // quote request they trigger is a no-op until the catalogue is marked ready below.
        const form = this.orderForm.controls;
        if (!options.filaments.some((option) => option.code === form.filament.value)) {
            form.filament.setValue(options.filaments[0].code);
            form.color.setValue(options.filaments[0].colors[0]?.code ?? '');
        }
        if (!options.qualities.some((option) => option.code === form.quality.value)) {
            const preferred = options.qualities.find((option) => option.code === PREFERRED_QUALITY);
            form.quality.setValue((preferred ?? options.qualities[0]).code);
        }
        form.quantity.updateValueAndValidity();

        this.catalogState.set('ready');
        // A file dropped while the catalogue was loading gets its quote now.
        this.requestQuote();
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
            this.quoteCache.set(outcome.job.key, outcome.quote);
            this.quote.set(outcome.quote);
            this.quoteError.set('');
            this.quoteState.set('ready');
            this.prefetchRuns.next(outcome.job);
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
        this.quoteCache.clear();
        this.prefetchRuns.next(null);
    }

    private releaseModelUrl() {
        const url = this.modelUrl();
        if (url) {
            URL.revokeObjectURL(url);
            this.modelUrl.set(undefined);
        }
    }
}
