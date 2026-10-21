import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    afterNextRender,
    computed,
    effect,
    inject,
    signal,
    untracked
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, concatMap, debounce, from, map, merge, of, switchMap, tap, timer } from 'rxjs';
import { CART_MAX_ITEMS, CartItem, CartService } from '../cart/cart.service';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';
import { formatPrintDuration } from '../quote/print-duration';
import { ColorOption, FilamentOption, QualityOption, QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent, describeQuoteError, isModelExpired } from '../quote/quote.service';

type UploadFormat = 'stl' | '3mf';
type QuoteState = 'idle' | 'loading' | 'ready' | 'error';
type UploadState = 'idle' | 'uploading' | 'done' | 'error';
type CatalogState = 'loading' | 'ready' | 'error';
type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';
/**
 * What the price box reports. 'uploading' shows the real transfer progress; 'slicing' and
 * 'repricing' wait for the backend with nothing to measure, the latter with a previous quote
 * still on screen.
 */
export type QuotePhase = 'idle' | 'uploading' | 'slicing' | 'repricing' | 'ready' | 'error';

interface QuoteJob {
    key: string;
    modelId: string;
    filament: string;
    color: string;
    pricePerKgChf: number;
    quality: string;
    quantity: number;
    /** Skip the debounce: the job follows an upload or a retry, not a form change. */
    immediate: boolean;
    /** Slice even if the cache holds this combination; the retry button needs that. */
    force: boolean;
}

interface QuoteOutcome {
    job: QuoteJob;
    quote: QuoteResponse | null;
    error: string;
    /** The backend no longer keeps the model; it has to be uploaded again first. */
    modelExpired: boolean;
}

type UploadOutcome = { file: File; event: UploadEvent } | { file: File; event: { kind: 'error'; message: string } };

/**
 * Every slicer run costs seconds of CPU and counts against the client's rate limit, so the
 * form waits until the user stops changing values before it asks the backend.
 */
export const QUOTE_DEBOUNCE_MS = 800;

/**
 * Once a quote is on screen, the other filaments at this quality and the other qualities with
 * this filament are fetched in the background, so switching between them is instant. The
 * pause keeps a user who is still changing values from triggering slices that are thrown away.
 */
export const PREFETCH_DELAY_MS = 1000;

/**
 * Identifies a quote. The colour itself is excluded because it never changes the slice; its
 * material price is included, so colours that cost the same share a quote and a dearer one
 * gets its own.
 */
function quoteKey(modelId: string, filament: string, quality: string, quantity: number, pricePerKgChf: number): string {
    return `${modelId}|${filament}|${quality}|${quantity}|${pricePerKgChf}`;
}

/**
 * Largest 3MF the browser is asked to preview. A 3MF is zipped XML and is parsed on the main
 * thread; a 20 MB file unpacks to over 100 MB of text and a million triangles, which freezes
 * the page for a long time. Binary STL parses fast and stays within the backend's 50 MB cap.
 */
export const PREVIEW_LIMIT_BYTES_3MF = 8 * 1024 * 1024;

/**
 * Below this size the upload finishes within one progress event, so a transfer bar would only
 * flash at 100 %; the price box goes straight to the slicing phase instead.
 */
export const UPLOAD_PROGRESS_MIN_BYTES = 2 * 1024 * 1024;

export interface SlicingStep {
    /** Milliseconds after the phase began at which this text takes over. */
    atMs: number;
    text: string;
}

/**
 * What the status line says while the slicer runs. The backend reports nothing until it is
 * done, so the stages are timed, not measured; they follow what a slice actually does and
 * the last one stays until the quote arrives.
 */
export const SLICING_STEPS: ReadonlyArray<SlicingStep> = [
    { atMs: 0, text: 'Modell wird gescannt...' },
    { atMs: 1500, text: 'Geometrie wird analysiert...' },
    { atMs: 3500, text: 'Schichten werden berechnet...' },
    { atMs: 8000, text: 'Druckzeit und Material werden ermittelt...' }
];

/** A re-price of a known model skips the scanning stages and ends with its own text. */
export const REPRICING_FIRST_STEP = 2;
export const REPRICING_FINAL_TEXT = 'Preis wird neu berechnet...';

/** How long "Fertig." lingers after the quote arrived before the box shows the price. */
export const QUOTE_DONE_FLASH_MS = 400;

/** The timed stages for a pending phase, rebased so that the first one starts at zero. */
export function slicingStepsFor(phase: 'slicing' | 'repricing'): ReadonlyArray<SlicingStep> {
    if (phase === 'slicing') {
        return SLICING_STEPS;
    }
    const steps = SLICING_STEPS.slice(REPRICING_FIRST_STEP);
    const offset = steps[0]?.atMs ?? 0;
    return steps.map((step, index) => ({
        atMs: step.atMs - offset,
        text: index === steps.length - 1 ? REPRICING_FINAL_TEXT : step.text
    }));
}

/** Chosen when the catalogue arrives, if the backend offers it; otherwise the first tier. */
const PREFERRED_QUALITY = 'medium';

/**
 * Upload, configure, quote, put in the cart. The catalogue (filaments, colours, qualities,
 * quantity limit) comes from the backend and nothing here is hard-coded: a new material in
 * the backend configuration shows up without a frontend release.
 */
@Component({
    selector: 'app-upload',
    imports: [ReactiveFormsModule, DecimalPipe, RouterLink, ModelViewerComponent],
    templateUrl: './upload.component.html',
    styleUrl: './upload.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadComponent {
    private readonly router = inject(Router);
    private readonly quoteService = inject(QuoteService);
    private readonly cart = inject(CartService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly uploads = new Subject<File | null>();
    private readonly quoteJobs = new Subject<QuoteJob | null>();
    private readonly prefetchRuns = new Subject<QuoteJob | null>();
    private readonly doneFlashes = new Subject<void>();
    /** One re-upload per file when the backend has dropped it; a second expiry is an error. */
    private reuploaded = false;

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
    /** The line just added; the confirmation with the next steps shows while it is set. */
    readonly addedItem = signal<CartItem | null>(null);
    readonly cartCount = this.cart.count;
    readonly cartItemCount = computed(() => this.cart.items().length);
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;
    readonly cartIsFull = this.cart.isFull;
    readonly maxCartItems = CART_MAX_ITEMS;
    readonly selectedFile = signal<File | null>(null);
    /** Id the backend keeps the uploaded model under; quotes reference it instead of the file. */
    readonly modelId = signal<string | null>(null);
    readonly uploadState = signal<UploadState>('idle');
    readonly uploadProgress = signal(0);
    readonly modelUrl = signal<string | undefined>(undefined);
    /** True when the file is too heavy for the in-browser preview; the quote is unaffected. */
    readonly previewDisabled = signal(false);
    readonly modelFormat = signal<UploadFormat | undefined>(undefined);

    readonly quote = signal<QuoteResponse | null>(null);
    readonly quoteState = signal<QuoteState>('idle');
    readonly quoteError = signal('');
    /** Index into {@link slicingStepsFor} of the current phase; advanced by timers. */
    readonly slicingStep = signal(0);
    /** True for a moment after a quote arrived: the box says "Fertig." before the price. */
    readonly quoteDoneFlash = signal(false);

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
    private readonly quantityValue = toSignal(this.orderForm.controls.quantity.valueChanges, {
        initialValue: this.orderForm.controls.quantity.value
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
    /**
     * True when the quote on screen was computed for exactly what the form says now. It is
     * false while a recalculation is pending and while the form is invalid, because then no
     * request is sent at all and the previous price would otherwise pass for the current one.
     */
    readonly quoteMatchesForm = computed(() => {
        const quote = this.quote();
        if (!quote || this.formStatus() !== 'VALID') {
            return false;
        }
        return (
            quote.quantity === Number(this.quantityValue()) &&
            quote.filament === this.selectedFilament() &&
            quote.quality === this.selectedQualityCode() &&
            quote.color.pricePerKgChf === (this.selectedColor()?.pricePerKgChf ?? 0)
        );
    });
    /** Quality label of the quote on screen, for the stale marker; falls back to the code. */
    readonly quoteQualityLabel = computed(() => {
        const code = this.quote()?.quality;
        return this.qualityOptions().find((option) => option.code === code)?.label ?? code ?? '';
    });
    /** The quote on screen is shown dimmed: a new one is pending or the form has moved on. */
    readonly quoteIsStale = computed(
        () =>
            this.quote() !== null &&
            (this.quoteState() !== 'ready' || this.quoteDoneFlash() || !this.quoteMatchesForm())
    );
    /** Which status the price box shows; see {@link QuotePhase}. */
    readonly quotePhase = computed<QuotePhase>(() => {
        const pending: QuotePhase = this.quote() ? 'repricing' : 'slicing';
        if (this.uploadState() === 'uploading') {
            const file = this.selectedFile();
            return file && file.size > UPLOAD_PROGRESS_MIN_BYTES ? 'uploading' : pending;
        }
        switch (this.quoteState()) {
            case 'loading':
                return pending;
            case 'ready':
                return 'ready';
            case 'error':
                return 'error';
            default:
                return 'idle';
        }
    });
    /** A progress bar is shown for these phases; the other phases are a line of text. */
    readonly quoteInProgress = computed(() => {
        const phase = this.quotePhase();
        return phase === 'uploading' || phase === 'slicing' || phase === 'repricing';
    });
    /** Fill of the status bar in percent; null means indeterminate (the slicer is running). */
    readonly quoteBarPercent = computed<number | null>(() => {
        if (this.quoteDoneFlash()) {
            return 100;
        }
        return this.quotePhase() === 'uploading' ? this.uploadProgress() : null;
    });
    /** The staged text next to the indeterminate bar, or "Fertig." right after the quote came. */
    readonly quoteStatusText = computed(() => {
        if (this.quoteDoneFlash()) {
            return 'Fertig.';
        }
        const phase = this.quotePhase();
        if (phase !== 'slicing' && phase !== 'repricing') {
            return '';
        }
        const steps = slicingStepsFor(phase);
        return steps[Math.min(this.slicingStep(), steps.length - 1)].text;
    });
    readonly canSubmitOrder = computed(
        () => this.quoteState() === 'ready' && this.quote() !== null && this.quoteMatchesForm()
    );
    readonly canAddToCart = computed(() => this.canSubmitOrder() && !this.cartIsFull());
    /** The slicer's warnings are collapsed by default; most customers do not need them. */
    readonly warningsOpen = signal(false);

    toggleWarnings() {
        this.warningsOpen.update((open) => !open);
    }

    /**
     * The quantity message appears once the customer has touched the field, not on first
     * paint. Touched and dirty are not signals; the template reads this after every form event.
     */
    get quantityErrorVisible(): boolean {
        const control = this.orderForm.controls.quantity;
        return control.invalid && (control.touched || control.dirty);
    }

    constructor() {
        // A new file cancels the upload of the previous one.
        this.uploads
            .pipe(
                switchMap((file) =>
                    file === null
                        ? EMPTY
                        : this.quoteService.uploadModel(file).pipe(
                              map((event): UploadOutcome => ({ file, event })),
                              catchError((error: unknown) =>
                                  of<UploadOutcome>({ file, event: { kind: 'error', message: describeQuoteError(error) } })
                              )
                          )
                ),
                takeUntilDestroyed()
            )
            .subscribe((outcome) => this.applyUploadOutcome(outcome));

        this.quoteJobs
            .pipe(
                debounce((job) => timer(job?.immediate ? 0 : QUOTE_DEBOUNCE_MS)),
                switchMap((job) => {
                    if (job === null) {
                        return EMPTY;
                    }
                    // A prefetch may have filled this combination while the job was debounced.
                    const cached = job.force ? undefined : this.quoteCache.get(job.key);
                    if (cached) {
                        return of<QuoteOutcome>({ job, quote: cached, error: '', modelExpired: false });
                    }
                    return this.quoteService.requestQuote(job.modelId, {
                              filament: job.filament,
                              color: job.color,
                              quality: job.quality,
                              quantity: job.quantity
                          }).pipe(
                              map((quote): QuoteOutcome => ({ job, quote, error: '', modelExpired: false })),
                              catchError((error: unknown) =>
                                  of<QuoteOutcome>({
                                      job,
                                      quote: null,
                                      error: describeQuoteError(error),
                                      modelExpired: isModelExpired(error)
                                  })
                              )
                          );
                }),
                takeUntilDestroyed()
            )
            .subscribe((outcome) => this.applyQuoteOutcome(outcome));

        this.prefetchRuns
            .pipe(
                switchMap((job) =>
                    job === null ? EMPTY : timer(PREFETCH_DELAY_MS).pipe(switchMap(() => this.prefetchNeighbours(job)))
                ),
                takeUntilDestroyed()
            )
            .subscribe();

        // The staged texts advance on timers that live exactly as long as the pending phase.
        effect((onCleanup) => {
            const phase = this.quotePhase();
            if (phase !== 'slicing' && phase !== 'repricing') {
                return;
            }
            untracked(() => this.slicingStep.set(0));
            const subscription = merge(
                ...slicingStepsFor(phase).map((step, index) => timer(step.atMs).pipe(map(() => index)))
            ).subscribe((index) => this.slicingStep.set(index));
            onCleanup(() => subscription.unsubscribe());
        });

        this.doneFlashes
            .pipe(
                switchMap(() => timer(QUOTE_DONE_FLASH_MS)),
                takeUntilDestroyed()
            )
            .subscribe(() => this.quoteDoneFlash.set(false));

        this.orderForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
            // A changed configuration is a new line; the confirmation for the previous one goes.
            this.addedItem.set(null);
            this.requestQuote();
        });
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
     * Asks the backend to slice and price the uploaded model with the current configuration.
     * Jobs whose slice-relevant values are unchanged are dropped unless {@code force} is set,
     * which the retry button uses; forced jobs also skip the debounce. Without a catalogue or
     * before the upload has finished there is nothing to send; the job runs once both are there.
     */
    requestQuote(force = false) {
        const modelId = this.modelId();
        if (!modelId || this.catalogState() !== 'ready' || this.orderForm.invalid) {
            return;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        // Right after a filament switch the form may still hold a colour the new filament does
        // not come in; selectedColor() already falls back to a stocked one.
        const selected = this.selectedColor();
        const color = selected?.code ?? this.orderForm.controls.color.value;
        const pricePerKgChf = selected?.pricePerKgChf ?? 0;
        const key = quoteKey(modelId, filament, quality, Number(quantity), pricePerKgChf);
        if (!force && key === this.lastRequestedKey) {
            return;
        }

        const job: QuoteJob = {
            key,
            modelId,
            filament,
            color,
            pricePerKgChf,
            quality,
            quantity: Number(quantity),
            immediate: force,
            force
        };

        this.lastRequestedKey = key;
        const cached = force ? undefined : this.quoteCache.get(key);
        if (cached) {
            // Served from the cache, and a slice still pending for an earlier choice is dropped.
            this.quoteJobs.next(null);
            this.applyQuoteOutcome({ job, quote: cached, error: '', modelExpired: false });
            return;
        }

        this.quoteDoneFlash.set(false);
        this.quoteState.set('loading');
        this.quoteError.set('');
        this.quoteJobs.next(job);
    }

    /**
     * Fetches the quotes next to the one on screen: the other filaments at this quality, the
     * other qualities with this filament, and this filament's other material prices (one
     * colour per price), one after the other so the slicer is not flooded. Best effort: a
     * failure only means that combination is sliced on demand when chosen. Cache hits on the
     * backend do not count against the rate limit, so repeating a prefetch after a change is
     * cheap for the user.
     */
    private prefetchNeighbours(job: QuoteJob) {
        const filaments = this.filamentOptions();
        const current = filaments.find((option) => option.code === job.filament);
        const currentColor = current?.colors.find((color) => color.code === job.color) ?? current?.colors[0];
        const otherTiers = (current?.colors ?? []).filter(
            (color, index, colors) =>
                color.pricePerKgChf !== job.pricePerKgChf &&
                colors.findIndex((other) => other.pricePerKgChf === color.pricePerKgChf) === index
        );
        const neighbours: { filament: string; quality: string; color: ColorOption | undefined }[] = [
            ...filaments
                .filter((option) => option.code !== job.filament)
                .map((option) => ({ filament: option.code, quality: job.quality, color: option.colors[0] })),
            ...this.qualityOptions()
                .filter((option) => option.code !== job.quality)
                .map((option) => ({ filament: job.filament, quality: option.code, color: currentColor })),
            ...otherTiers.map((color) => ({ filament: job.filament, quality: job.quality, color }))
        ];
        return from(neighbours).pipe(
            concatMap(({ filament, quality, color }) => {
                const key = quoteKey(job.modelId, filament, quality, job.quantity, color?.pricePerKgChf ?? 0);
                if (this.quoteCache.has(key)) {
                    return EMPTY;
                }
                const params = { filament, color: color?.code ?? '', quality, quantity: job.quantity };
                return this.quoteService.requestQuote(job.modelId, params).pipe(
                    tap((quote) => this.quoteCache.set(key, quote)),
                    catchError(() => EMPTY)
                );
            })
        );
    }

    private applyUploadOutcome({ file, event }: UploadOutcome) {
        if (file !== this.selectedFile()) {
            return;
        }
        switch (event.kind) {
            case 'progress':
                this.uploadProgress.set(event.percent);
                break;
            case 'done':
                this.uploadProgress.set(100);
                this.uploadState.set('done');
                this.modelId.set(event.model.modelId);
                this.requestQuote(true);
                break;
            case 'error':
                this.uploadState.set('error');
                this.quote.set(null);
                this.quoteError.set(event.message);
                this.quoteState.set('error');
                break;
        }
    }

    private startUpload(file: File) {
        this.modelId.set(null);
        this.uploadState.set('uploading');
        this.uploadProgress.set(0);
        this.quoteDoneFlash.set(false);
        this.quoteState.set('loading');
        this.quoteError.set('');
        this.uploads.next(file);
    }

    /** Adds the configured model as a cart line; the model stays on screen with the next steps. */
    onAddToCart() {
        const item = this.putInCart();
        if (item) {
            this.addedItem.set(item);
        }
    }

    /** Adds the model and goes straight to the checkout. */
    onDirectCheckout() {
        if (!this.putInCart()) {
            return;
        }

        void this.router.navigate(['/checkout']);
    }

    /** Back to the dropzone for the next model; the cart keeps what was added. */
    onUploadAnother() {
        this.addedItem.set(null);
        this.resetModel();
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

    /** Puts the configured model with its quote into the cart as a new line. */
    private putInCart(): CartItem | null {
        const file = this.selectedFile();
        const modelId = this.modelId();
        const quote = this.quote();
        const color = this.selectedColor();
        if (!this.canAddToCart() || !file || !modelId || !quote || !color) {
            return null;
        }

        const { filament, quality, quantity } = this.orderForm.getRawValue();
        return this.cart.add({
            file,
            fileName: file.name,
            sizeBytes: file.size,
            modelId,
            filament,
            color,
            quality,
            quantity: Number(quantity),
            quote
        });
    }

    private handleFile(file: File) {
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension !== 'stl' && extension !== '3mf') {
            this.errorMessage.set('Nur STL oder 3MF Dateien sind erlaubt.');
            return;
        }

        this.errorMessage.set('');
        this.addedItem.set(null);
        this.resetModel();

        this.selectedFile.set(file);
        this.modelFormat.set(extension);
        this.modelLoadProgress.set(0);
        const previewable = extension !== '3mf' || file.size <= PREVIEW_LIMIT_BYTES_3MF;
        this.previewDisabled.set(!previewable);
        this.isModelLoading.set(previewable);
        this.modelUrl.set(URL.createObjectURL(file));

        this.startUpload(file);
    }

    private applyQuoteOutcome(outcome: QuoteOutcome) {
        if (outcome.quote) {
            // A quote the customer waited for gets a short "Fertig."; a cache hit is instant.
            if (this.quoteState() === 'loading') {
                this.quoteDoneFlash.set(true);
                this.doneFlashes.next();
            }
            this.quoteCache.set(outcome.job.key, outcome.quote);
            this.quote.set(outcome.quote);
            this.quoteError.set('');
            this.quoteState.set('ready');
            this.prefetchRuns.next(outcome.job);
            return;
        }

        const file = this.selectedFile();
        if (outcome.modelExpired && file && !this.reuploaded) {
            // The backend dropped the model (restart or expiry): upload it once more, then the
            // same quote is requested again when the upload completes.
            this.reuploaded = true;
            this.quoteCache.clear();
            this.lastRequestedKey = '';
            this.startUpload(file);
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
        this.previewDisabled.set(false);
        this.quote.set(null);
        this.quoteError.set('');
        this.quoteState.set('idle');
        this.quoteDoneFlash.set(false);
        this.isModelLoading.set(false);
        this.modelLoadProgress.set(0);
        this.lastRequestedKey = '';
        this.quoteCache.clear();
        this.prefetchRuns.next(null);
        this.quoteJobs.next(null);
        this.uploads.next(null);
        this.modelId.set(null);
        this.uploadState.set('idle');
        this.uploadProgress.set(0);
        this.reuploaded = false;
    }

    private releaseModelUrl() {
        const url = this.modelUrl();
        if (url) {
            URL.revokeObjectURL(url);
            this.modelUrl.set(undefined);
        }
    }
}
