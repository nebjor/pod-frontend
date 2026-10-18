import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QuoteResponse } from './quote.models';
import { QUOTE_API_URL, QuoteService, describeQuoteError } from './quote.service';

const sampleQuote: QuoteResponse = {
    fileName: 'cube.stl',
    filament: 'PETG',
    quality: 'high',
    quantity: 3,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.12,
    printTimeSeconds: 3821,
    filamentLengthMm: 3567,
    filamentGrams: 10.9,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 4.25,
    materialCostChf: 0.45,
    setupFeeChf: 5,
    unitPriceChf: 4.7,
    totalPriceChf: 19.1,
    currency: 'CHF',
    leadTimeDays: 4
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

    it('posts the model and parameters as multipart form data', () => {
        const file = new File(['solid cube'], 'cube.stl', { type: 'model/stl' });
        let received: QuoteResponse | undefined;

        service
            .requestQuote(file, { filament: 'PETG', quality: 'high', quantity: 3 })
            .subscribe((quote) => (received = quote));

        const request = http.expectOne(QUOTE_API_URL);
        expect(request.request.method).toBe('POST');

        const body = request.request.body as FormData;
        expect(body.get('filament')).toBe('PETG');
        expect(body.get('quality')).toBe('high');
        expect(body.get('quantity')).toBe('3');
        expect((body.get('file') as File).name).toBe('cube.stl');

        request.flush(sampleQuote);
        expect(received?.totalPriceChf).toBe(19.1);
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

        expect(describeQuoteError(new HttpErrorResponse({ status: 0 }))).toContain('nicht erreichbar');
        expect(describeQuoteError(new HttpErrorResponse({ status: 413 }))).toContain('zu gross');
        expect(describeQuoteError(new HttpErrorResponse({ status: 500 }))).toContain('HTTP 500');
        expect(describeQuoteError(new Error('boom'))).toBe('Angebot konnte nicht berechnet werden.');
    });
});
