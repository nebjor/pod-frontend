import { HttpErrorResponse, HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QuoteResponse } from './quote.models';
import { loadDictionary, translate } from '../i18n/i18n.service';
import { MODEL_API_URL, QUOTE_API_URL, QuoteService, UploadEvent, describeQuoteError, isModelExpired } from './quote.service';

const sampleQuote: QuoteResponse = {
    fileName: 'cube.stl',
    filament: 'PETG',
    color: { code: 'white', label: 'White', hex: '#f2f2f2', pricePerKgChf: 45 },
    quality: 'high',
    quantity: 3,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.12,
    plateCount: 1,
    printTimeSeconds: 3821,
    totalPrintTimeSeconds: 11463,
    filamentLengthMm: 10701,
    filamentGrams: 10.9,
    totalFilamentGrams: 32.7,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 4.25,
    materialCostChf: 0.45,
    unitPriceChf: 4.7,
    totalPriceChf: 19.1,
    currency: 'CHF',
    leadTimeDays: 4,
    warnings: [],
    manifold: true
};

describe('QuoteService', () => {
    let service: QuoteService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(QuoteService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('uploads the model once and reports progress, then the id the backend keeps it under', () => {
        const file = new File(['solid cube'], 'cube.stl', { type: 'model/stl' });
        const events: UploadEvent[] = [];

        service.uploadModel(file).subscribe((event) => events.push(event));

        const request = http.expectOne(MODEL_API_URL);
        expect(request.request.method).toBe('POST');
        expect(request.request.reportProgress).toBe(true);
        expect(((request.request.body as FormData).get('file') as File).name).toBe('cube.stl');

        request.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
        request.flush({ modelId: 'a'.repeat(64), fileName: 'cube.stl', sizeBytes: 10 });

        expect(events).toEqual([
            { kind: 'progress', percent: 50 },
            { kind: 'done', model: { modelId: 'a'.repeat(64), fileName: 'cube.stl', sizeBytes: 10 } }
        ]);
    });

    it('posts the model id and parameters as multipart form data', () => {
        let received: QuoteResponse | undefined;

        service
            .requestQuote('a'.repeat(64), { filament: 'PETG', color: 'white', quality: 'high', quantity: 3 })
            .subscribe((quote) => (received = quote));

        const request = http.expectOne(QUOTE_API_URL);
        expect(request.request.method).toBe('POST');

        const body = request.request.body as FormData;
        expect(body.get('modelId')).toBe('a'.repeat(64));
        expect(body.get('filament')).toBe('PETG');
        expect(body.get('color')).toBe('white');
        expect(body.get('quality')).toBe('high');
        expect(body.get('quantity')).toBe('3');
        expect(body.has('file')).toBe(false);

        request.flush(sampleQuote);
        expect(received?.totalPriceChf).toBe(19.1);
    });

    it('recognises the backend telling us to upload the model again', () => {
        expect(isModelExpired(new HttpErrorResponse({ status: 404, error: { code: 'model-expired' } }))).toBe(true);
        expect(isModelExpired(new HttpErrorResponse({ status: 404, error: { detail: 'Sample file not found.' } }))).toBe(false);
        expect(isModelExpired(new HttpErrorResponse({ status: 500 }))).toBe(false);
        expect(isModelExpired(new Error('boom'))).toBe(false);
    });

    it('loads the available options', () => {
        let received: unknown;
        service.loadOptions().subscribe((options) => (received = options));

        const request = http.expectOne(`${QUOTE_API_URL}/options`);
        expect(request.request.method).toBe('GET');
        request.flush({ filaments: [], qualities: [], maxQuantity: 100 });
        expect(received).toEqual({ filaments: [], qualities: [], maxQuantity: 100 });
    });

    it('turns backend problem details into a readable message', () => {
        const badRequest = new HttpErrorResponse({ status: 400, error: { detail: 'Only .stl and .3mf files are supported.' } });
        expect(describeQuoteError(badRequest)).toBe('Only .stl and .3mf files are supported.');

        const limited = new HttpErrorResponse({
            status: 429,
            error: { detail: 'Rate limit reached', retryAfterSeconds: 42, supportEmail: 'help@example.com' }
        });
        expect(describeQuoteError(limited)).toBe('Limit erreicht. Probier es in 42 Sekunden noch einmal. Falls es eilt, schreib an help@example.com.');
        expect(describeQuoteError(new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 1800 } })))
            .toBe('Limit erreicht. Probier es in 30 Minuten noch einmal.');
        expect(describeQuoteError(new HttpErrorResponse({ status: 503, error: { retryAfterSeconds: 20 } })))
            .toContain('ausgelastet');

        expect(describeQuoteError(new HttpErrorResponse({ status: 0 }))).toContain('nicht erreichbar');
        expect(describeQuoteError(new HttpErrorResponse({ status: 413 }))).toContain('zu gross');
        // Status codes never reach the customer; a bare failure gets a short line to act on.
        const serverError = describeQuoteError(new HttpErrorResponse({ status: 500 }));
        expect(serverError).toContain('nicht berechnet werden');
        expect(serverError).not.toContain('HTTP');
        expect(serverError).not.toContain('500');
        expect(describeQuoteError(new Error('boom'))).toBe(serverError);
    });

    it('words its own messages in the language it is given', async () => {
        await loadDictionary('en');
        const english = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
            translate('en', key, params);
        const limited = new HttpErrorResponse({
            status: 429,
            error: { retryAfterSeconds: 42, supportEmail: 'help@example.com' }
        });

        expect(describeQuoteError(limited, english)).toBe(
            'Limit reached. Please try again in 42 seconds. If it is urgent, write to help@example.com.'
        );
        expect(describeQuoteError(new HttpErrorResponse({ status: 0 }), english)).toContain('unreachable');
        // The backend's own wording is shown as it is, whatever the language.
        expect(describeQuoteError(new HttpErrorResponse({ status: 400, error: { detail: 'Nur STL.' } }), english)).toBe('Nur STL.');
    });
});
