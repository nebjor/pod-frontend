import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent } from '../quote/quote.service';
import { PREFETCH_DELAY_MS, QUOTE_DEBOUNCE_MS, UploadComponent, formatPrintDuration } from './upload.component';

const sampleQuote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'black', label: 'Black', hex: '#1f1f1f' },
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
    leadTimeDays: 3
};

/** What the backend publishes; the component holds no catalogue of its own. */
const backendOptions: QuoteOptions = {
    filaments: [
        {
            code: 'PLA',
            label: 'PLA',
            profileName: 'Bambu PLA Basic @BBL A1',
            colors: [
                { code: 'black', label: 'Charcoal Black (matt)', hex: '#2b2b2b' },
                { code: 'red', label: 'Red', hex: '#d62828' }
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
        }
    ],
    qualities: [
        { code: 'coarse', label: 'Grob', profileName: '0.24mm Draft @BBL A1', layerHeightMm: 0.24, baseLeadTimeDays: 2 },
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 20
};

const MODEL_ID = 'a'.repeat(64);
const uploaded: UploadEvent = { kind: 'done', model: { modelId: MODEL_ID, fileName: 'benchy.stl', sizeBytes: 28 } };

/** Minimal stand-in for a drop event; only what the component reads. */
function dropEvent(file: File): DragEvent {
    return {
        preventDefault: () => undefined,
        dataTransfer: { files: { item: () => file } }
    } as unknown as DragEvent;
}

/** The app is zoneless, so the debounce is driven with Vitest fake timers instead of fakeAsync. */
function settle() {
    vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
}

describe('UploadComponent', () => {
    let fixture: ComponentFixture<UploadComponent>;
    let component: UploadComponent;
    let requestQuote: ReturnType<typeof vi.fn>;
    let loadOptions: ReturnType<typeof vi.fn>;
    let uploadModel: ReturnType<typeof vi.fn>;
    const benchy = new File(['solid benchy endsolid benchy'], 'benchy.stl');

    beforeEach(async () => {
        vi.useFakeTimers();

        // jsdom has no object URLs; the component only needs a string to hand to the viewer.
        URL.createObjectURL = vi.fn(() => 'blob:benchy');
        URL.revokeObjectURL = vi.fn();

        requestQuote = vi.fn(() => of(sampleQuote));
        loadOptions = vi.fn(() => of(backendOptions));
        uploadModel = vi.fn(() => of(uploaded));

        await TestBed.configureTestingModule({
            imports: [UploadComponent],
            providers: [provideRouter([]), { provide: QuoteService, useValue: { requestQuote, loadOptions, uploadModel } }]
        }).compileComponents();

        fixture = TestBed.createComponent(UploadComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Parameters of every quote request for one filament and quality, prefetches included. */
    function requestsFor(filament: string, quality: string) {
        return requestQuote.mock.calls
            .map((call) => call[1] as { filament: string; quality: string })
            .filter((params) => params.filament === filament && params.quality === quality);
    }

    it('takes filaments, qualities and the quantity limit from the backend', () => {
        expect(component.catalogState()).toBe('ready');
        expect(component.filamentOptions().map((option) => option.code)).toEqual(['PLA', 'PETG']);
        expect(component.qualityOptions().map((option) => option.code)).toEqual(['coarse', 'medium', 'high']);
        expect(component.orderForm.getRawValue()).toMatchObject({ filament: 'PLA', color: 'black', quality: 'medium' });

        component.orderForm.controls.quantity.setValue(21);
        expect(component.orderForm.controls.quantity.invalid).toBe(true);
    });

    it('waits for the catalogue before quoting a file dropped early', async () => {
        const { Subject } = await import('rxjs');
        const options = new Subject<QuoteOptions>();
        loadOptions.mockReturnValue(options);
        const early = TestBed.createComponent(UploadComponent);
        early.detectChanges();

        early.componentInstance.onDrop(dropEvent(benchy));
        settle();
        expect(early.componentInstance.catalogState()).toBe('loading');
        expect(requestQuote).not.toHaveBeenCalled();

        options.next(backendOptions);
        settle();
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

    it('uploads the model once and quotes it by id with the current configuration', () => {
        component.onDrop(dropEvent(benchy));
        settle();

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(uploadModel.mock.calls[0][0]).toBe(benchy);
        expect(component.uploadState()).toBe('done');
        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][0]).toBe(MODEL_ID);
        expect(requestQuote.mock.calls[0][1]).toEqual({
            filament: 'PLA',
            color: 'black',
            quality: 'medium',
            quantity: 1
        });
        expect(component.quoteState()).toBe('ready');
        expect(component.quote()?.totalPriceChf).toBe(8);
        expect(component.canSubmitOrder()).toBe(true);
    });

    it('collapses rapid changes into a single request', () => {
        component.onDrop(dropEvent(benchy));
        component.orderForm.controls.quantity.setValue(2);
        component.orderForm.controls.quantity.setValue(3);
        settle();

        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][1].quantity).toBe(3);
    });

    it('does not slice again when only the colour changes', () => {
        component.onDrop(dropEvent(benchy));
        settle();

        component.orderForm.controls.color.setValue('red');
        settle();

        // Background prefetches aside, the PLA/medium slice was requested exactly once.
        expect(requestsFor('PLA', 'medium')).toHaveLength(1);
        expect(component.selectedColor()?.code).toBe('red');
        expect(component.quoteState()).toBe('ready');
    });

    it('falls back to a stocked colour when the filament changes', () => {
        component.onDrop(dropEvent(benchy));
        settle();
        component.orderForm.controls.color.setValue('red');

        component.orderForm.controls.filament.setValue('PETG');
        fixture.detectChanges();
        settle();

        expect(component.availableColors().map((color) => color.code)).toEqual(['black', 'white']);
        expect(component.orderForm.controls.color.value).toBe('black');
        expect(requestsFor('PETG', 'medium')).toEqual([{ filament: 'PETG', color: 'black', quality: 'medium', quantity: 1 }]);
    });

    it('shows the upload progress and keeps the last price visible while recalculating', async () => {
        const { Subject } = await import('rxjs');
        const upload = new Subject<UploadEvent>();
        uploadModel.mockReturnValueOnce(upload);

        component.onDrop(dropEvent(benchy));
        upload.next({ kind: 'progress', percent: 40 });
        expect(component.uploadState()).toBe('uploading');
        expect(component.uploadProgress()).toBe(40);
        expect(requestQuote).not.toHaveBeenCalled();

        upload.next(uploaded);
        upload.complete();
        settle();
        expect(component.quoteState()).toBe('ready');

        // A form change recalculates, but the previous quote stays on screen meanwhile.
        component.orderForm.controls.quantity.setValue(2);
        expect(component.quoteState()).toBe('loading');
        expect(component.quote()?.totalPriceChf).toBe(8);
        settle();
        expect(component.quoteState()).toBe('ready');
    });

    it('uploads again once when the backend has dropped the model, then retries the quote', () => {
        requestQuote.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired' } }))
        );

        component.onDrop(dropEvent(benchy));
        settle();

        expect(uploadModel).toHaveBeenCalledTimes(2);
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quoteState()).toBe('ready');
        expect(component.quote()?.totalPriceChf).toBe(8);
    });

    it('prefetches the other filaments and qualities after a quote so that switching is instant', () => {
        requestQuote.mockImplementation((_file: File, params: { filament: string }) =>
            of({ ...sampleQuote, filament: params.filament, totalPriceChf: params.filament === 'PETG' ? 9 : 8 })
        );

        component.onDrop(dropEvent(benchy));
        settle();
        expect(requestQuote).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(PREFETCH_DELAY_MS);
        expect(requestQuote).toHaveBeenCalledTimes(4);
        expect(requestQuote.mock.calls.slice(1).map((call) => call[1])).toEqual([
            { filament: 'PETG', color: 'black', quality: 'medium', quantity: 1 },
            { filament: 'PLA', color: 'black', quality: 'coarse', quantity: 1 },
            { filament: 'PLA', color: 'black', quality: 'high', quantity: 1 }
        ]);
        expect(component.quote()?.filament).toBe('PLA');

        component.orderForm.controls.filament.setValue('PETG');
        fixture.detectChanges();
        settle();

        expect(requestQuote).toHaveBeenCalledTimes(4);
        expect(component.quoteState()).toBe('ready');
        expect(component.quote()?.totalPriceChf).toBe(9);

        component.orderForm.controls.filament.setValue('PLA');
        component.orderForm.controls.quality.setValue('high');
        fixture.detectChanges();
        settle();
        expect(requestQuote).toHaveBeenCalledTimes(4);
        expect(component.quote()?.totalPriceChf).toBe(8);
    });

    it('slices on demand when a prefetch failed, and forgets the cache with the file', () => {
        requestQuote.mockImplementation((_file: File, params: { filament: string }) =>
            params.filament === 'PETG' && requestQuote.mock.calls.length === 2
                ? throwError(() => new HttpErrorResponse({ status: 503 }))
                : of({ ...sampleQuote, filament: params.filament })
        );

        component.onDrop(dropEvent(benchy));
        settle();
        vi.advanceTimersByTime(PREFETCH_DELAY_MS);
        expect(requestQuote).toHaveBeenCalledTimes(4);
        expect(component.quoteState()).toBe('ready');

        component.orderForm.controls.filament.setValue('PETG');
        fixture.detectChanges();
        settle();
        expect(requestQuote).toHaveBeenCalledTimes(5);
        expect(component.quote()?.filament).toBe('PETG');

        component.onDrop(dropEvent(new File(['solid other endsolid other'], 'other.stl')));
        settle();
        expect(uploadModel).toHaveBeenCalledTimes(2);
        expect(requestQuote).toHaveBeenCalledTimes(6);
        expect(requestQuote.mock.calls[5][1].filament).toBe('PETG');
    });

    it('does not request while the quantity is invalid', () => {
        component.onDrop(dropEvent(benchy));
        settle();

        component.orderForm.controls.quantity.setValue(99);
        settle();

        expect(requestQuote.mock.calls.some((call) => call[1].quantity === 99)).toBe(false);
        expect(component.canSubmitOrder()).toBe(false);
    });

    it('shows the backend message on failure and allows a forced retry', () => {
        requestQuote.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 30 } }))
        );

        component.onDrop(dropEvent(benchy));
        settle();
        expect(component.quoteState()).toBe('error');
        expect(component.quoteError()).toContain('Limit erreicht');
        expect(component.canSubmitOrder()).toBe(false);

        component.requestQuote(true);
        settle();
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(component.quoteState()).toBe('ready');
    });

    it('rejects files that are not STL or 3MF without contacting the backend', () => {
        component.onDrop(dropEvent(new File(['x'], 'model.glb')));
        settle();

        expect(component.errorMessage()).toContain('STL oder 3MF');
        expect(requestQuote).not.toHaveBeenCalled();
    });

    it('formats print durations for people', () => {
        expect(formatPrintDuration(0)).toBe('0 min');
        expect(formatPrintDuration(2239)).toBe('37 min');
        expect(formatPrintDuration(3821)).toBe('1 h 04 min');
        expect(formatPrintDuration(36656)).toBe('10 h 11 min');
    });
});
