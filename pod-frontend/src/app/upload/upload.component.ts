import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    afterRenderEffect,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, map, merge, of, switchMap, timer } from 'rxjs';
import { CART_MAX_ITEMS, CartItem, CartService } from '../cart/cart.service';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';
import { formatQualityOption } from '../quote/quality-labels';
import { ColorOption, FilamentOption, QualityOption, QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent, describeQuoteError, isModelExpired } from '../quote/quote.service';
import { QuoteOverlayComponent } from './quote-overlay/quote-overlay.component';

type UploadFormat = 'stl' | '3mf';
type QuoteState = 'idle' | 'loading' | 'ready' | 'error';
type UploadState = 'idle' | 'uploading' | 'done' | 'error';
type CatalogState = 'loading' | 'ready' | 'error';
type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';
/**
 * What the loading screen reports. 'uploading' shows the real transfer progress; 'slicing'
 * and 'repricing' wait for the backend with nothing to measure, the latter for a model the
 * backend has already sliced once.
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
 * flash at 100 %; the loading screen goes straight to the slicing phase instead.
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

/** How long "Fertig." lingers after the quote arrived before the result takes over. */
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
 * Upload, configure, quote, put in the cart, in that order and one step at a time. The file
 * is uploaded as soon as it is dropped so the preview and the transfer overlap, but nothing
 * is sliced until the customer asks for the price; the quote then takes over the screen,
 * first as a loading screen, then as the result. The catalogue (filaments, colours,
 * qualities, quantity limit) comes from the backend and nothing here is hard-coded: a new
 * material in the backend configuration shows up without a frontend release.
 */
@Component({
    selector: 'app-upload',
    imports: [ReactiveFormsModule, DecimalPipe, RouterLink, ModelViewerComponent, QuoteOverlayComponent],
    templateUrl: './upload.component.html',
    styleUrl: './upload.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadComponent {
    private readonly quoteService = inject(QuoteService);
    private readonly cart = inject(CartService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly uploads = new Subject<File | null>();
    private readonly quoteJobs = new Subject<QuoteJob | null>();
    private readonly doneFlashes = new Subject<void>();
    private readonly loadingOverlay = viewChild<ElementRef<HTMLElement>>('loadingOverlay');
    private readonly calculateButton = viewChild<ElementRef<HTMLButtonElement>>('calculateButton');
    /** True while an overlay holds the focus; it goes back to the button when both close. */
    private overlayHadFocus = false;
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
    readonly cartItemCount = computed(() => this.cart.items().length);
    /** "1 Modell" / "3 Modelle": the number of lines in the cart, for the note under the button. */
    readonly cartModelsLabel = computed(() => {
        const count = this.cartItemCount();
        return `${count} ${count === 1 ? 'Modell' : 'Modelle'}`;
    });
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
    /**
     * True from "Preis berechnen" until "Anpassen", a failure or a new file: the overlays are
     * shown only while it is set, so neither of them exists on the server or before the click.
     */
    readonly quoteRequested = signal(false);
    /** Index into {@link slicingStepsFor} of the current phase; advanced by timers. */
    readonly slicingStep = signal(0);
    /** True for a moment after a quote arrived: the loading screen says "Fertig." first. */
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
    readonly selectedQualityLabel = computed(() => {
        const option = this.selectedQualityOption();
        return option ? formatQualityOption(option) : '';
    });

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
    /**
     * True when the quote in hand was computed for exactly what the form says now. It is
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
    /** Which status the loading screen shows; see {@link QuotePhase}. */
    readonly quotePhase = computed<QuotePhase>(() => {
        const pending: QuotePhase = this.quote() ? 'repricing' : 'slicing';
        if (this.uploadState() === 'uploading' && this.quoteRequested()) {
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
    /** The loading screen is shown for these phases. */
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
    /** The full-screen loading screen: from the click until the quote (or "Fertig.") is there. */
    readonly loadingOverlayOpen = computed(
        () => this.quoteRequested() && (this.quoteInProgress() || this.quoteDoneFlash())
    );
    /** The quote on the full-screen result, or null while that screen is closed. */
    readonly quoteOnScreen = computed<QuoteResponse | null>(() =>
        this.quoteRequested() && this.quotePhase() === 'ready' && !this.quoteDoneFlash() && this.quoteMatchesForm()
            ? this.quote()
            : null
    );
    readonly overlayOpen = computed(() => this.loadingOverlayOpen() || this.quoteOnScreen() !== null);
    /** 1 upload, 2 configuration, 3 price: for the step indicator in the header. */
    readonly currentStep = computed(() => (!this.selectedFile() ? 1 : this.overlayOpen() ? 3 : 2));
    /** The price in hand is for the current choices: the button shows it again without a slice. */
    readonly quoteCurrent = computed(() => this.quoteState() === 'ready' && this.quoteMatchesForm());
    readonly canSubmitOrder = computed(
        () => this.quoteState() === 'ready' && this.quote() !== null && this.quoteMatchesForm()
    );
    readonly canAddToCart = computed(() => this.canSubmitOrder() && !this.cartIsFull());

    /** "Standard 0.20 mm", the same wording the cart and the order pages use. */
    qualityOptionLabel(option: QualityOption): string {
        return formatQualityOption(option);
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

        // A newer job cancels the slice still running for an older one.
        this.quoteJobs
            .pipe(
                switchMap((job) =>
                    job === null
                        ? EMPTY
                        : this.quoteService
                              .requestQuote(job.modelId, {
                                  filament: job.filament,
                                  color: job.color,
                                  quality: job.quality,
                                  quantity: job.quantity
                              })
                              .pipe(
                                  map((quote): QuoteOutcome => ({ job, quote, error: '', modelExpired: false })),
                                  catchError((error: unknown) =>
                                      of<QuoteOutcome>({
                                          job,
                                          quote: null,
                                          error: describeQuoteError(error),
                                          modelExpired: isModelExpired(error)
                                      })
                                  )
                              )
                ),
                takeUntilDestroyed()
            )
            .subscribe((outcome) => this.applyQuoteOutcome(outcome));

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

        // A changed configuration is a new line; the confirmation for the previous one goes.
        this.orderForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.addedItem.set(null));
        this.destroyRef.onDestroy(() => this.releaseModelUrl());

        // A filament switch may drop the chosen colour; fall back to the first stocked one.
        effect(() => {
            const colors = this.availableColors();
            const current = this.selectedColorCode();
            if (colors.length > 0 && !colors.some((color) => color.code === current)) {
                this.orderForm.controls.color.setValue(colors[0].code);
            }
        });

        // The overlays take the focus when they open; the result screen does that itself. When
        // both are gone the focus returns to the button that opened them.
        afterRenderEffect(() => {
            const loading = this.loadingOverlay();
            const resultOpen = this.quoteOnScreen() !== null;
            if (loading) {
                loading.nativeElement.focus();
                this.overlayHadFocus = true;
            } else if (resultOpen) {
                this.overlayHadFocus = true;
            } else if (this.overlayHadFocus) {
                this.overlayHadFocus = false;
                untracked(() => this.calculateButton())?.nativeElement.focus();
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
     * "Preis berechnen": opens the loading screen and asks for the quote. An upload still in
     * transfer is waited for and the quote follows it; a failed upload is repeated first. A
     * failed quote is retried; a quote already in hand is shown again without a slice.
     */
    onCalculatePrice() {
        const file = this.selectedFile();
        if (!file || this.catalogState() !== 'ready') {
            return;
        }
        if (this.orderForm.invalid) {
            this.orderForm.markAllAsTouched();
            return;
        }

        this.quoteRequested.set(true);
        if (this.uploadState() === 'error') {
            this.startUpload(file);
            return;
        }
        this.requestQuote(this.quoteState() === 'error');
    }

    /** "Anpassen" or Escape: back to the configuration; the quote stays cached. */
    onAdjust() {
        this.quoteRequested.set(false);
    }

    /**
     * Asks the backend to slice and price the uploaded model with the current configuration.
     * A job whose slice-relevant values match the last one is dropped unless {@code force} is
     * set, which a retry after a failure needs. Without a catalogue or before the upload has
     * finished there is nothing to send; the job runs once both are there.
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
            quantity: Number(quantity)
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
                // The customer asked for the price during the transfer: it follows right away.
                if (this.quoteRequested()) {
                    this.requestQuote(true);
                }
                break;
            case 'error':
                this.uploadState.set('error');
                this.quote.set(null);
                this.quoteError.set(event.message);
                this.quoteState.set('error');
                this.quoteRequested.set(false);
                break;
        }
    }

    private startUpload(file: File) {
        this.modelId.set(null);
        this.uploadState.set('uploading');
        this.uploadProgress.set(0);
        this.quoteDoneFlash.set(false);
        this.quoteError.set('');
        this.uploads.next(file);
    }

    /** Adds the configured model as a cart line; the result stays on screen with the next steps. */
    onAddToCart() {
        const item = this.putInCart();
        if (item) {
            this.addedItem.set(item);
        }
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

        // Values are set with events so the signals derived from valueChanges follow.
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

        // Uploaded right away so the transfer overlaps the preview; the slice waits for the click.
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

        // The message is shown on the configuration step, under the button that retries.
        this.quote.set(null);
        this.quoteError.set(outcome.error);
        this.quoteState.set('error');
        this.quoteRequested.set(false);
    }

    private resetModel() {
        this.releaseModelUrl();
        this.selectedFile.set(null);
        this.modelFormat.set(undefined);
        this.previewDisabled.set(false);
        this.quote.set(null);
        this.quoteError.set('');
        this.quoteState.set('idle');
        this.quoteRequested.set(false);
        this.quoteDoneFlash.set(false);
        this.isModelLoading.set(false);
        this.modelLoadProgress.set(0);
        this.lastRequestedKey = '';
        this.quoteCache.clear();
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
