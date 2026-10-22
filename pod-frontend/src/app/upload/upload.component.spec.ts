import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CART_MAX_ITEMS, CartService } from '../cart/cart.service';
import { formatPrintDuration } from '../quote/print-duration';
import { QuoteOptions, QuoteRequestParams, QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent } from '../quote/quote.service';
import {
    PREVIEW_LIMIT_BYTES_3MF,
    QUOTE_DONE_FLASH_MS,
    REPRICING_FINAL_TEXT,
    SLICING_STEPS,
    UPLOAD_PROGRESS_MIN_BYTES,
    UploadComponent
} from './upload.component';

const sampleQuote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'black', label: 'Black', hex: '#1f1f1f', pricePerKgChf: 36 },
    quality: 'medium',
    quantity: 1,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    printTimeSeconds: 2239,
    totalPrintTimeSeconds: 2239,
    filamentLengthMm: 3880.6,
    filamentGrams: 11.6,
    totalFilamentGrams: 11.6,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 2.5,
    materialCostChf: 0.4,
    setupFeeChf: 5,
    unitPriceChf: 3,
    totalPriceChf: 8,
    currency: 'CHF',
    leadTimeDays: 3,
    warnings: [],
    manifold: true
};

/** What the backend publishes; the component holds no catalogue of its own. */
const backendOptions: QuoteOptions = {
    filaments: [
        {
            code: 'PLA',
            label: 'PLA',
            profileName: 'Bambu PLA Basic @BBL A1',
            colors: [
                { code: 'black', label: 'Charcoal Black (matt)', hex: '#2b2b2b', pricePerKgChf: 36 },
                { code: 'white', label: 'Cotton White (matt)', hex: '#f1ede3', pricePerKgChf: 36 },
                { code: 'red', label: 'Red', hex: '#d62828', pricePerKgChf: 45 }
            ]
        },
        {
            code: 'PETG',
            label: 'PETG',
            profileName: 'PolyLite PETG @BBL A1',
            colors: [
                { code: 'black', label: 'Black', hex: '#1f1f1f', pricePerKgChf: 45 },
                { code: 'white', label: 'White', hex: '#f2f2f2', pricePerKgChf: 45 }
            ]
        }
    ],
    qualities: [
        { code: 'coarse', label: 'Grob', profileName: '0.24mm Draft @BBL A1', layerHeightMm: 0.24, baseLeadTimeDays: 2 },
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 20
};

/** The backend echoes the configuration it priced; the result screen compares the form with it. */
function quoteFor(params: QuoteRequestParams): QuoteResponse {
    const filament = backendOptions.filaments.find((option) => option.code === params.filament);
    const color = filament?.colors.find((option) => option.code === params.color) ?? sampleQuote.color;
    return { ...sampleQuote, filament: params.filament, quality: params.quality, quantity: params.quantity, color };
}

const MODEL_ID = 'a'.repeat(64);
const uploaded: UploadEvent = { kind: 'done', model: { modelId: MODEL_ID, fileName: 'benchy.stl', sizeBytes: 28 } };

/** Minimal stand-in for a drop event; only what the component reads. */
function dropEvent(file: File): DragEvent {
    return {
        preventDefault: () => undefined,
        dataTransfer: { files: { item: () => file } }
    } as unknown as DragEvent;
}

describe('UploadComponent', () => {
    let fixture: ComponentFixture<UploadComponent>;
    let component: UploadComponent;
    let host: HTMLElement;
    let cart: CartService;
    let requestQuote: ReturnType<typeof vi.fn>;
    let loadOptions: ReturnType<typeof vi.fn>;
    let uploadModel: ReturnType<typeof vi.fn>;
    const benchy = new File(['solid benchy endsolid benchy'], 'benchy.stl');

    beforeEach(async () => {
        vi.useFakeTimers();

        // jsdom has no object URLs; the component only needs a string to hand to the viewer.
        URL.createObjectURL = vi.fn(() => 'blob:benchy');
        URL.revokeObjectURL = vi.fn();

        requestQuote = vi.fn((_id: string, params: QuoteRequestParams) => of(quoteFor(params)));
        loadOptions = vi.fn(() => of(backendOptions));
        uploadModel = vi.fn(() => of(uploaded));

        await TestBed.configureTestingModule({
            imports: [UploadComponent],
            providers: [provideRouter([]), { provide: QuoteService, useValue: { requestQuote, loadOptions, uploadModel } }]
        }).compileComponents();

        cart = TestBed.inject(CartService);
        fixture = TestBed.createComponent(UploadComponent);
        component = fixture.componentInstance;
        host = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
        sessionStorage.clear();
        localStorage.clear();
    });

    /** Parameters of every quote request for one filament and quality. */
    function requestsFor(filament: string, quality: string) {
        return requestQuote.mock.calls
            .map((call) => call[1] as { filament: string; color: string; quality: string })
            .filter((params) => params.filament === filament && params.quality === quality);
    }

    /** "Preis berechnen" as the customer presses it, with the template in sync afterwards. */
    function calculate() {
        fixture.detectChanges();
        host.querySelector<HTMLButtonElement>('.calculate-btn')!.click();
        fixture.detectChanges();
    }

    /** Lets "Fertig." pass so the result screen replaces the loading screen. */
    function finishFlash() {
        vi.advanceTimersByTime(QUOTE_DONE_FLASH_MS);
        fixture.detectChanges();
    }

    const loadingOverlay = () => host.querySelector<HTMLElement>('.loading-panel');
    const quoteScreen = () => host.querySelector<HTMLElement>('app-quote-overlay');

    it('takes filaments, qualities and the quantity limit from the backend', () => {
        expect(component.catalogState()).toBe('ready');
        expect(component.filamentOptions().map((option) => option.code)).toEqual(['PLA', 'PETG']);
        expect(component.qualityOptions().map((option) => option.code)).toEqual(['coarse', 'medium', 'high']);
        expect(component.orderForm.getRawValue()).toMatchObject({ filament: 'PLA', color: 'black', quality: 'medium' });

        component.orderForm.controls.quantity.setValue(21);
        expect(component.orderForm.controls.quantity.invalid).toBe(true);
    });

    it('shows the dropzone without any overlay on first render', () => {
        expect(host.querySelector('.dropzone')).not.toBeNull();
        expect(loadingOverlay()).toBeNull();
        expect(quoteScreen()).toBeNull();
        expect(component.currentStep()).toBe(1);
        expect(host.querySelector('.steps [aria-current="step"]')?.textContent?.trim()).toBe('Upload');
    });

    it('needs the catalogue before the price of an early dropped file can be requested', () => {
        const options = new Subject<QuoteOptions>();
        loadOptions.mockReturnValue(options);
        const early = TestBed.createComponent(UploadComponent);
        early.detectChanges();

        early.componentInstance.onDrop(dropEvent(benchy));
        early.componentInstance.onCalculatePrice();
        expect(early.componentInstance.catalogState()).toBe('loading');
        expect(early.componentInstance.quoteRequested()).toBe(false);
        expect(requestQuote).not.toHaveBeenCalled();

        // The catalogue arriving does not slice by itself; the click does.
        options.next(backendOptions);
        expect(requestQuote).not.toHaveBeenCalled();
        early.componentInstance.onCalculatePrice();
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][1]).toMatchObject({ filament: 'PLA', color: 'black', quality: 'medium' });
    });

    it('offers a retry when the catalogue cannot be loaded', () => {
        loadOptions.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
        const failing = TestBed.createComponent(UploadComponent);
        failing.detectChanges();
        expect(failing.componentInstance.catalogState()).toBe('error');

        failing.componentInstance.loadCatalog();
        expect(failing.componentInstance.catalogState()).toBe('ready');
    });

    it('uploads the model on drop but sends no quote request until the price is asked for', () => {
        component.onDrop(dropEvent(benchy));
        fixture.detectChanges();

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(uploadModel.mock.calls[0][0]).toBe(benchy);
        expect(component.uploadState()).toBe('done');
        expect(component.modelId()).toBe(MODEL_ID);
        expect(requestQuote).not.toHaveBeenCalled();
        expect(component.quoteState()).toBe('idle');
        expect(component.currentStep()).toBe(2);
        expect(host.querySelector('.order-form')).not.toBeNull();
        expect(host.querySelector('.calculate-btn')?.textContent?.trim()).toBe('Preis berechnen');
        expect(loadingOverlay()).toBeNull();
        expect(quoteScreen()).toBeNull();

        // Changing the configuration slices nothing either.
        component.orderForm.controls.quantity.setValue(2);
        component.orderForm.controls.filament.setValue('PETG');
        component.orderForm.controls.quality.setValue('high');
        component.orderForm.controls.color.setValue('white');
        fixture.detectChanges();
        expect(requestQuote).not.toHaveBeenCalled();
        expect(component.quoteState()).toBe('idle');

        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][0]).toBe(MODEL_ID);
        expect(requestQuote.mock.calls[0][1]).toEqual({ filament: 'PETG', color: 'white', quality: 'high', quantity: 2 });
        expect(component.quoteState()).toBe('ready');
        expect(component.canSubmitOrder()).toBe(true);
    });

    it('shows the loading screen with the staged progress while the quote runs, then the result', () => {
        const pending = new Subject<QuoteResponse>();
        requestQuote.mockImplementation(() => pending);
        component.onDrop(dropEvent(benchy));

        calculate();
        expect(component.quoteState()).toBe('loading');
        expect(component.quotePhase()).toBe('slicing');
        expect(component.currentStep()).toBe(3);
        const overlay = loadingOverlay()!;
        expect(overlay).not.toBeNull();
        expect(overlay.getAttribute('aria-busy')).toBe('true');
        expect(host.querySelector('h1')?.textContent).toContain('Preis wird berechnet');
        expect(host.querySelector('.order-card')).toBeNull();
        expect(overlay.textContent).toContain('benchy.stl');
        expect(overlay.textContent).toContain(SLICING_STEPS[0].text);
        expect(overlay.textContent).toContain('Wir slicen deine Datei wirklich');
        expect(overlay.getAttribute('aria-live')).toBe('polite');
        expect(overlay.querySelector('.loading-track')?.classList.contains('indeterminate')).toBe(true);
        expect(overlay.querySelector('button, a, input')).toBeNull();
        expect(quoteScreen()).toBeNull();
        // The progress card is page content; focus moves into it for screen readers.
        expect(host.querySelector('.upload-page')?.hasAttribute('inert')).toBe(false);
        expect(document.activeElement).toBe(overlay);

        pending.next(quoteFor({ filament: 'PLA', color: 'black', quality: 'medium', quantity: 1 }));
        pending.complete();
        fixture.detectChanges();
        expect(component.quoteState()).toBe('ready');
        expect(component.quoteDoneFlash()).toBe(true);
        expect(loadingOverlay()?.textContent).toContain('Fertig.');
        expect(quoteScreen()).toBeNull();

        finishFlash();
        expect(loadingOverlay()).toBeNull();
        const screen = quoteScreen()!;
        expect(screen).not.toBeNull();
        expect(screen.querySelector('.price-value')?.textContent?.trim()).toBe('CHF 8.00');
        expect(screen.textContent).toContain(formatPrintDuration(2239));
        expect(screen.textContent).toContain('11.6 g PLA');
        expect(screen.textContent).toContain('Standard 0.20 mm');
        expect(screen.textContent).toContain('1 Stück');
        expect(screen.querySelector('.add-btn')?.textContent?.trim()).toBe('In den Warenkorb');
        expect(screen.querySelector('.adjust-btn')?.textContent?.trim()).toBe('Anpassen');
        expect(host.querySelector('h1')?.textContent).toContain('Dein Angebot');
        expect(host.querySelector('.order-card')).toBeNull();
        expect(screen.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement).toBe(screen.querySelector('.quote-screen'));
    });

    it('returns to the configuration on "Anpassen" and keeps the model and the choices', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.quantity.setValue(3);
        calculate();
        finishFlash();
        expect(quoteScreen()).not.toBeNull();

        quoteScreen()!.querySelector<HTMLButtonElement>('.adjust-btn')!.click();
        fixture.detectChanges();

        expect(quoteScreen()).toBeNull();
        expect(loadingOverlay()).toBeNull();
        expect(component.currentStep()).toBe(2);
        expect(component.selectedFile()).toBe(benchy);
        expect(component.modelId()).toBe(MODEL_ID);
        expect(component.orderForm.controls.quantity.value).toBe(3);
        expect(host.querySelector('.upload-page')?.hasAttribute('inert')).toBe(false);
        expect(host.querySelector('.quote-hint')?.textContent).toContain('CHF 8.00');
        expect(document.activeElement).toBe(host.querySelector('.calculate-btn'));
    });

    it('closes the result screen on Escape', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        expect(quoteScreen()).not.toBeNull();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();

        expect(quoteScreen()).toBeNull();
        expect(component.quoteRequested()).toBe(false);
        expect(component.selectedFile()).toBe(benchy);
    });

    it('reuses the cached quote when the price is asked for again without a change', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        expect(requestQuote).toHaveBeenCalledTimes(1);

        component.onAdjust();
        fixture.detectChanges();
        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(1);
        // No slice, no waiting: the result is back at once.
        expect(loadingOverlay()).toBeNull();
        expect(quoteScreen()?.querySelector('.price-value')?.textContent?.trim()).toBe('CHF 8.00');

        // Another quality is a new slice; back to the first one it is the cached quote again.
        component.onAdjust();
        component.orderForm.controls.quality.setValue('high');
        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quote()?.quality).toBe('high');
        finishFlash();

        component.onAdjust();
        component.orderForm.controls.quality.setValue('medium');
        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quote()?.quality).toBe('medium');
        expect(quoteScreen()).not.toBeNull();
    });

    it('forgets the cache with the file', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        expect(requestQuote).toHaveBeenCalledTimes(1);

        component.onDrop(dropEvent(new File(['solid other endsolid other'], 'other.stl')));
        fixture.detectChanges();
        expect(uploadModel).toHaveBeenCalledTimes(2);
        expect(quoteScreen()).toBeNull();
        expect(component.quoteState()).toBe('idle');

        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(2);
    });

    it('does not request again when the new colour costs the same', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();

        component.onAdjust();
        component.orderForm.controls.color.setValue('white');
        expect(component.quoteMatchesForm()).toBe(true);
        calculate();

        expect(requestsFor('PLA', 'medium')).toHaveLength(1);
        expect(component.selectedColor()?.code).toBe('white');
        expect(quoteScreen()?.textContent).toContain('Cotton White (matt)');
    });

    it('re-prices when the new colour has another material price', () => {
        requestQuote.mockImplementation((_id: string, params: QuoteRequestParams) =>
            of({ ...quoteFor(params), materialCostChf: params.color === 'red' ? 0.5 : 0.4 })
        );
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        expect(component.quoteMatchesForm()).toBe(true);

        // Same filament and quality, but red costs more per kilogram than black.
        component.onAdjust();
        component.orderForm.controls.color.setValue('red');
        expect(component.quoteMatchesForm()).toBe(false);
        calculate();

        expect(requestsFor('PLA', 'medium').map((params) => params.color)).toEqual(['black', 'red']);
        expect(component.quote()?.materialCostChf).toBe(0.5);
        expect(component.quote()?.color.pricePerKgChf).toBe(45);
        expect(component.quoteMatchesForm()).toBe(true);
    });

    it('falls back to a stocked colour when the filament changes', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.color.setValue('red');

        component.orderForm.controls.filament.setValue('PETG');
        fixture.detectChanges();

        expect(component.availableColors().map((color) => color.code)).toEqual(['black', 'white']);
        expect(component.orderForm.controls.color.value).toBe('black');
        calculate();
        expect(requestsFor('PETG', 'medium')).toEqual([{ filament: 'PETG', color: 'black', quality: 'medium', quantity: 1 }]);
    });

    it('waits for the transfer when the price is asked for during the upload', () => {
        const upload = new Subject<UploadEvent>();
        uploadModel.mockReturnValueOnce(upload);

        component.onDrop(dropEvent(benchy));
        upload.next({ kind: 'progress', percent: 40 });
        fixture.detectChanges();
        expect(component.uploadState()).toBe('uploading');
        expect(component.uploadProgress()).toBe(40);
        // Nothing is asked for yet: the configuration step shows no progress of the transfer.
        expect(component.quotePhase()).toBe('idle');
        expect(loadingOverlay()).toBeNull();

        calculate();
        expect(loadingOverlay()).not.toBeNull();
        expect(requestQuote).not.toHaveBeenCalled();

        upload.next(uploaded);
        upload.complete();
        fixture.detectChanges();
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(component.quoteState()).toBe('ready');
        finishFlash();
        expect(quoteScreen()).not.toBeNull();
    });

    it('shows the transfer bar for a large file only and hands over to an indeterminate slicer phase', () => {
        const upload = new Subject<UploadEvent>();
        uploadModel.mockReturnValueOnce(upload);
        const large = new File([new Uint8Array(UPLOAD_PROGRESS_MIN_BYTES + 1)], 'large.stl');

        component.onDrop(dropEvent(large));
        calculate();
        upload.next({ kind: 'progress', percent: 40 });
        fixture.detectChanges();
        expect(component.quotePhase()).toBe('uploading');
        expect(loadingOverlay()?.textContent).toContain('Modell wird hochgeladen... 40%');
        const track = loadingOverlay()!.querySelector<HTMLElement>('.loading-track')!;
        expect(track.classList.contains('indeterminate')).toBe(false);
        expect(track.getAttribute('aria-valuenow')).toBe('40');
        expect(loadingOverlay()!.querySelector<HTMLElement>('.loading-fill')?.style.width).toBe('40%');

        // The upload is done and the slicer runs: the same bar turns indeterminate.
        const pending = new Subject<QuoteResponse>();
        requestQuote.mockReturnValueOnce(pending);
        upload.next({ kind: 'done', model: { modelId: MODEL_ID, fileName: 'large.stl', sizeBytes: large.size } });
        upload.complete();
        fixture.detectChanges();
        expect(component.uploadState()).toBe('done');
        expect(component.quotePhase()).toBe('slicing');
        expect(loadingOverlay()?.textContent).toContain(SLICING_STEPS[0].text);
        expect(loadingOverlay()!.querySelector('.loading-track')?.classList.contains('indeterminate')).toBe(true);
        expect(loadingOverlay()!.querySelector('.loading-track')?.hasAttribute('aria-valuenow')).toBe(false);

        pending.next(quoteFor({ filament: 'PLA', color: 'black', quality: 'medium', quantity: 1 }));
        finishFlash();
        expect(component.quotePhase()).toBe('ready');
        expect(loadingOverlay()).toBeNull();

        // A small file is transferred within one progress event; a bar would only flash at 100 %.
        const second = new Subject<UploadEvent>();
        uploadModel.mockReturnValueOnce(second);
        component.onDrop(dropEvent(benchy));
        calculate();
        second.next({ kind: 'progress', percent: 100 });
        fixture.detectChanges();
        expect(component.uploadState()).toBe('uploading');
        expect(component.quotePhase()).toBe('slicing');
        expect(loadingOverlay()?.textContent).toContain(SLICING_STEPS[0].text);
        expect(loadingOverlay()?.textContent).not.toContain('hochgeladen');
        expect(loadingOverlay()!.querySelector('.loading-track')?.classList.contains('indeterminate')).toBe(true);
    });

    it('uploads again once when the backend has dropped the model, then retries the quote', () => {
        requestQuote.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired' } }))
        );

        component.onDrop(dropEvent(benchy));
        calculate();

        expect(uploadModel).toHaveBeenCalledTimes(2);
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quoteState()).toBe('ready');
        expect(component.quote()?.totalPriceChf).toBe(8);
        finishFlash();
        expect(quoteScreen()).not.toBeNull();
    });

    it('repeats a failed upload when the price is asked for', () => {
        uploadModel.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

        component.onDrop(dropEvent(benchy));
        fixture.detectChanges();
        expect(component.uploadState()).toBe('error');
        expect(component.quotePhase()).toBe('error');
        expect(host.querySelector('.quote-cta .status-error')).not.toBeNull();
        expect(loadingOverlay()).toBeNull();

        calculate();
        expect(uploadModel).toHaveBeenCalledTimes(2);
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(component.quoteState()).toBe('ready');
    });

    it('shows the backend message on failure in the configuration step and retries on the next click', () => {
        const pending = new Subject<QuoteResponse>();
        requestQuote.mockReturnValueOnce(pending);

        component.onDrop(dropEvent(benchy));
        calculate();
        expect(document.activeElement).toBe(loadingOverlay());

        pending.error(new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 30 } }));
        fixture.detectChanges();
        expect(component.quoteState()).toBe('error');
        expect(component.quoteError()).toContain('Limit erreicht');
        expect(component.canSubmitOrder()).toBe(false);
        expect(loadingOverlay()).toBeNull();
        expect(quoteScreen()).toBeNull();
        expect(host.querySelector('.quote-cta .status-error')?.textContent).toContain('Limit erreicht');
        expect(document.activeElement).toBe(host.querySelector('.calculate-btn'));

        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quoteState()).toBe('ready');
        finishFlash();
        expect(quoteScreen()).not.toBeNull();
        expect(host.querySelector('.quote-cta .status-error')).toBeNull();
    });

    it('does not request while the quantity is invalid and points at the field instead', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.quantity.setValue(99);
        fixture.detectChanges();
        expect(host.querySelector('.field-error')).toBeNull();

        calculate();

        expect(requestQuote).not.toHaveBeenCalled();
        expect(component.quoteRequested()).toBe(false);
        expect(loadingOverlay()).toBeNull();
        expect(component.canSubmitOrder()).toBe(false);
        expect(host.querySelector('.field-error')?.textContent?.trim()).toBe('Bitte 1 bis 20 Stück');
    });

    it('explains an invalid quantity once the field has been touched', () => {
        component.onDrop(dropEvent(benchy));
        fixture.detectChanges();
        const input = host.querySelector<HTMLInputElement>('input[formControlName="quantity"]')!;
        expect(host.querySelector('.field-error')).toBeNull();

        // Typed above the catalogue limit: the customer is told why the button will not slice.
        const quantity = component.orderForm.controls.quantity;
        quantity.setValue(100);
        quantity.markAsDirty();
        fixture.detectChanges();

        expect(host.querySelector('.field-error')?.textContent?.trim()).toBe('Bitte 1 bis 20 Stück');
        expect(input.classList.contains('invalid')).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe('quantity-error');
        expect(host.querySelector('#quantity-error')).not.toBeNull();
        expect(component.quoteMatchesForm()).toBe(false);

        // Cleared through the keyboard: the number accessor reports null, the message changes.
        input.value = '';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(host.querySelector('.field-error')?.textContent?.trim()).toBe('Bitte eine Menge eingeben');

        quantity.setValue(1);
        fixture.detectChanges();
        expect(host.querySelector('.field-error')).toBeNull();
        expect(input.getAttribute('aria-invalid')).toBe('false');
        expect(input.hasAttribute('aria-describedby')).toBe(false);
    });

    it('keeps the quantity message quiet until the field has been touched', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.quantity.setValue(0);
        fixture.detectChanges();
        expect(host.querySelector('.field-error')).toBeNull();

        component.orderForm.controls.quantity.markAsTouched();
        fixture.detectChanges();
        expect(host.querySelector('.field-error')?.textContent?.trim()).toBe('Bitte 1 bis 20 Stück');
    });

    it('treats a quote in hand as current only while the form still matches it', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        component.onAdjust();
        fixture.detectChanges();
        expect(component.quoteMatchesForm()).toBe(true);
        expect(component.canSubmitOrder()).toBe(true);
        expect(host.querySelector('.quote-hint')?.textContent).toContain('Preis für diese Konfiguration');

        component.orderForm.controls.quantity.setValue(2);
        fixture.detectChanges();
        expect(component.quoteMatchesForm()).toBe(false);
        expect(component.canSubmitOrder()).toBe(false);
        expect(host.querySelector('.quote-hint')?.textContent).not.toContain('CHF');

        component.orderForm.controls.quantity.setValue(1);
        expect(component.quoteMatchesForm()).toBe(true);
    });

    it('cycles through the staged slicer texts while the quote is pending, then flashes "Fertig."', () => {
        const pending = new Subject<QuoteResponse>();
        requestQuote.mockImplementation(() => pending);
        const text = () => host.querySelector('.quote-phase .phase-text')?.textContent;
        const showAfter = (ms: number) => {
            vi.advanceTimersByTime(ms);
            fixture.detectChanges();
            return text();
        };

        component.onDrop(dropEvent(benchy));
        calculate();
        expect(component.quotePhase()).toBe('slicing');
        expect(text()).toBe(SLICING_STEPS[0].text);

        expect(showAfter(1499)).toBe(SLICING_STEPS[0].text);
        expect(showAfter(1)).toBe(SLICING_STEPS[1].text);
        expect(showAfter(2000)).toBe(SLICING_STEPS[2].text);
        expect(showAfter(4500)).toBe(SLICING_STEPS[3].text);
        // The last stage stays however long the slicer takes.
        expect(showAfter(30000)).toBe(SLICING_STEPS[3].text);
        expect(requestQuote).toHaveBeenCalledTimes(1);

        pending.next(quoteFor({ filament: 'PLA', color: 'black', quality: 'medium', quantity: 1 }));
        fixture.detectChanges();
        expect(component.quoteState()).toBe('ready');
        expect(component.canSubmitOrder()).toBe(true);
        expect(component.quoteDoneFlash()).toBe(true);
        expect(text()).toBe('Fertig.');
        expect(host.querySelector('.quote-phase .check')).not.toBeNull();
        expect(host.querySelector('.quote-phase .spinner')).toBeNull();
        expect(host.querySelector('.quote-phase .loading-track')?.classList.contains('indeterminate')).toBe(false);
        expect(host.querySelector<HTMLElement>('.quote-phase .loading-fill')?.style.width).toBe('100%');
        expect(quoteScreen()).toBeNull();

        expect(showAfter(QUOTE_DONE_FLASH_MS - 1)).toBe('Fertig.');
        expect(showAfter(1)).toBeUndefined();
        expect(component.quoteDoneFlash()).toBe(false);
        expect(loadingOverlay()).toBeNull();
        expect(quoteScreen()).not.toBeNull();
    });

    it('starts a re-price of a known model at the layer stage and ends with its own text', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        const pending = new Subject<QuoteResponse>();
        requestQuote.mockImplementation((_id: string, params: QuoteRequestParams) =>
            params.quantity === 3 ? pending : of(quoteFor(params))
        );
        const text = () => host.querySelector('.quote-phase .phase-text')?.textContent;

        component.onAdjust();
        component.orderForm.controls.quantity.setValue(3);
        calculate();
        expect(component.quotePhase()).toBe('repricing');
        expect(loadingOverlay()).not.toBeNull();
        expect(quoteScreen()).toBeNull();
        expect(text()).toBe(SLICING_STEPS[2].text);

        vi.advanceTimersByTime(4499);
        fixture.detectChanges();
        expect(text()).toBe(SLICING_STEPS[2].text);
        vi.advanceTimersByTime(1);
        fixture.detectChanges();
        expect(text()).toBe(REPRICING_FINAL_TEXT);
        expect(requestQuote.mock.calls.some((call) => call[1].quantity === 3)).toBe(true);
    });

    it('warns about a model that is not watertight and keeps the slicer warnings behind a toggle', () => {
        requestQuote.mockReturnValue(of({ ...sampleQuote, manifold: false, warnings: ['Open edges: 12', 'Non-manifold edges: 4'] }));
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();

        const screen = quoteScreen()!;
        expect(screen.querySelector('.manifold-note')?.textContent).toContain('nicht wasserdicht');
        const toggle = screen.querySelector<HTMLButtonElement>('.warnings-toggle');
        expect(toggle?.textContent?.trim()).toBe('Hinweise vom Slicer (2)');
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(screen.querySelector('.warnings-list')).toBeNull();

        toggle?.click();
        fixture.detectChanges();
        const items = screen.querySelectorAll('.warnings-list li');
        expect(Array.from(items).map((li) => li.textContent)).toEqual(['Open edges: 12', 'Non-manifold edges: 4']);
        expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    });

    it('says nothing about the mesh when it is fine or was not checked', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        expect(quoteScreen()!.querySelector('.manifold-note')).toBeNull();
        expect(quoteScreen()!.querySelector('.slicer-warnings')).toBeNull();

        requestQuote.mockReturnValue(of({ ...sampleQuote, quantity: 2, manifold: null }));
        component.onAdjust();
        component.orderForm.controls.quantity.setValue(2);
        calculate();
        finishFlash();
        expect(quoteScreen()!.querySelector('.manifold-note')).toBeNull();
    });

    it('says the model is being prepared once its bytes are in but the viewer has not finished', () => {
        component.onDrop(dropEvent(benchy));
        // jsdom has no WebGL, so the viewer reports an error on first render; the events below
        // replay what a real browser sends: loading, byte progress, then loaded after parsing.
        fixture.detectChanges();

        component.onModelLoadStateChange('loading');
        component.onModelLoadProgress(45);
        fixture.detectChanges();
        expect(host.querySelector('.viewer-loading')?.textContent).toContain('Lade Modell... 45%');
        expect(host.querySelector('.viewer-loading .loading-track')?.classList.contains('indeterminate')).toBe(false);
        expect(host.querySelector<HTMLElement>('.viewer-loading .loading-fill')?.style.width).toBe('45%');

        component.onModelLoadProgress(100);
        fixture.detectChanges();
        expect(host.querySelector('.viewer-loading')?.textContent).toContain('Modell wird aufbereitet...');
        expect(host.querySelector('.viewer-loading')?.textContent).not.toContain('100%');
        expect(host.querySelector('.viewer-loading .loading-track')?.classList.contains('indeterminate')).toBe(true);

        component.onModelLoadStateChange('loaded');
        fixture.detectChanges();
        expect(host.querySelector('.viewer-loading')).toBeNull();
    });

    it('keeps the preview on screen while configuring', () => {
        component.onDrop(dropEvent(benchy));
        fixture.detectChanges();
        expect(host.querySelector('app-model-viewer')).not.toBeNull();
        expect(host.querySelector('.file-meta')?.textContent).toContain('benchy.stl');

        // The preview stays behind the loading screen and the result; the viewer is not rebuilt.
        const viewer = host.querySelector('app-model-viewer');
        calculate();
        expect(host.querySelector('app-model-viewer')).toBe(viewer);
        finishFlash();
        expect(host.querySelector('app-model-viewer')).toBe(viewer);
    });

    it('skips the browser preview for a 3MF above the size limit but still quotes it', () => {
        const heavy = new File([new Uint8Array(PREVIEW_LIMIT_BYTES_3MF + 1)], 'spider.3mf');

        component.onDrop(dropEvent(heavy));
        fixture.detectChanges();
        expect(component.previewDisabled()).toBe(true);
        expect(component.isModelLoading()).toBe(false);
        expect(host.querySelector('.viewer-placeholder')).not.toBeNull();
        expect(host.querySelector('app-model-viewer')).toBeNull();

        calculate();
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(component.quoteState()).toBe('ready');

        component.onDrop(dropEvent(benchy));
        expect(component.previewDisabled()).toBe(false);
    });

    it('rejects files that are not STL or 3MF without contacting the backend', () => {
        component.onDrop(dropEvent(new File(['x'], 'model.glb')));

        expect(component.errorMessage()).toContain('STL oder 3MF');
        expect(uploadModel).not.toHaveBeenCalled();
        expect(requestQuote).not.toHaveBeenCalled();
    });

    it('puts the configured model into the cart as a line with its model id and quote', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.quantity.setValue(2);
        calculate();
        finishFlash();
        expect(cart.isEmpty()).toBe(true);

        quoteScreen()!.querySelector<HTMLButtonElement>('.add-btn')!.click();
        fixture.detectChanges();

        expect(cart.items()).toHaveLength(1);
        expect(cart.items()[0]).toMatchObject({
            fileName: 'benchy.stl',
            sizeBytes: benchy.size,
            modelId: MODEL_ID,
            filament: 'PLA',
            color: { code: 'black' },
            quality: 'medium',
            quantity: 2,
            quote: { totalPriceChf: 8 }
        });
        expect(cart.items()[0].file).toBe(benchy);
        expect(component.addedItem()?.id).toBe(cart.items()[0].id);
        // The result stays on screen with the next steps; the model is kept for another line.
        expect(component.selectedFile()).toBe(benchy);
        const screen = quoteScreen()!;
        expect(screen.querySelector('.cart-added')?.textContent).toContain('liegt im Warenkorb');
        expect(screen.querySelector('.cart-added a[href="/warenkorb"]')).not.toBeNull();
        expect(screen.querySelector('.cart-added a[href="/checkout"]')).not.toBeNull();
        expect(screen.querySelector('.add-btn')).toBeNull();
    });

    it('adds a second line for a changed configuration and resets for the next model', () => {
        component.onDrop(dropEvent(benchy));
        calculate();
        finishFlash();
        component.onAddToCart();

        component.onAdjust();
        component.orderForm.controls.quality.setValue('high');
        expect(component.addedItem()).toBeNull();
        calculate();
        finishFlash();
        component.onAddToCart();
        expect(cart.items().map((item) => item.quality)).toEqual(['medium', 'high']);

        component.onUploadAnother();
        fixture.detectChanges();
        expect(component.selectedFile()).toBeNull();
        expect(component.addedItem()).toBeNull();
        expect(component.quoteRequested()).toBe(false);
        expect(quoteScreen()).toBeNull();
        expect(host.querySelector('.dropzone')).not.toBeNull();
        expect(cart.items()).toHaveLength(2);
    });

    it('does not add without a ready quote', () => {
        component.onDrop(dropEvent(benchy));
        expect(component.quoteState()).toBe('idle');

        component.onAddToCart();

        expect(cart.isEmpty()).toBe(true);
        expect(component.addedItem()).toBeNull();
    });

    it('refuses to add once the cart holds the maximum number of models', () => {
        component.onDrop(dropEvent(benchy));
        for (let index = 0; index < CART_MAX_ITEMS; index++) {
            component.onAdjust();
            component.orderForm.controls.quantity.setValue(index + 1);
            calculate();
            finishFlash();
            component.onAddToCart();
        }
        expect(cart.items()).toHaveLength(CART_MAX_ITEMS);
        expect(component.cartIsFull()).toBe(true);
        expect(component.canAddToCart()).toBe(false);

        component.onAdjust();
        component.orderForm.controls.quantity.setValue(1);
        calculate();
        finishFlash();
        component.onAddToCart();
        expect(cart.items()).toHaveLength(CART_MAX_ITEMS);
        fixture.detectChanges();
        expect(quoteScreen()?.textContent).toContain('Warenkorb ist voll');
        expect(quoteScreen()?.querySelector<HTMLButtonElement>('.add-btn')?.disabled).toBe(true);
    });

    it('formats print durations for people', () => {
        expect(formatPrintDuration(0)).toBe('0 min');
        expect(formatPrintDuration(2239)).toBe('37 min');
        expect(formatPrintDuration(3821)).toBe('1 h 04 min');
        expect(formatPrintDuration(36656)).toBe('10 h 11 min');
    });
});
