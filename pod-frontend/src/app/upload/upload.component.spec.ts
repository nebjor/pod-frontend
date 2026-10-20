import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService } from '../quote/quote.service';
import { QUOTE_DEBOUNCE_MS, UploadComponent, formatPrintDuration } from './upload.component';

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
    const benchy = new File(['solid benchy endsolid benchy'], 'benchy.stl');

    beforeEach(async () => {
        vi.useFakeTimers();

        // jsdom has no object URLs; the component only needs a string to hand to the viewer.
        URL.createObjectURL = vi.fn(() => 'blob:benchy');
        URL.revokeObjectURL = vi.fn();

        requestQuote = vi.fn(() => of(sampleQuote));
        loadOptions = vi.fn(() => of(backendOptions));

        await TestBed.configureTestingModule({
            imports: [UploadComponent],
            providers: [provideRouter([]), { provide: QuoteService, useValue: { requestQuote, loadOptions } }]
        }).compileComponents();

        fixture = TestBed.createComponent(UploadComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

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

    it('requests one quote with the current configuration once a file is dropped', () => {
        component.onDrop(dropEvent(benchy));
        settle();

        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][1]).toEqual({
            file: benchy,
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

        expect(requestQuote).toHaveBeenCalledTimes(1);
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
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(requestQuote.mock.calls[1][1]).toMatchObject({ filament: 'PETG', color: 'black' });
    });

    it('does not request while the quantity is invalid', () => {
        component.onDrop(dropEvent(benchy));
        settle();

        component.orderForm.controls.quantity.setValue(99);
        settle();

        expect(requestQuote).toHaveBeenCalledTimes(1);
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
