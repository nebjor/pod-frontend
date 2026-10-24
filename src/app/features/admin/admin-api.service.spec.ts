import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminApiService } from './admin-api.service';
import { adminAuthInterceptor } from './admin-auth.interceptor';
import { AdminAuthService } from './admin-auth.service';

describe('AdminApiService with the auth interceptor', () => {
    let api: AdminApiService;
    let auth: AdminAuthService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(withInterceptors([adminAuthInterceptor])), provideHttpClientTesting()]
        });
        api = TestBed.inject(AdminApiService);
        auth = TestBed.inject(AdminAuthService);
        http = TestBed.inject(HttpTestingController);
        sessionStorage.clear();
    });

    afterEach(() => http.verify());

    it('sends the owner credentials with admin calls only', () => {
        auth.login('admin', 'secret');

        api.listOrders('PAID').subscribe();
        const request = http.expectOne((r) => r.url === '/api/admin/orders');
        expect(request.request.headers.get('Authorization')).toBe('Basic ' + btoa('admin:secret'));
        expect(request.request.params.get('status')).toBe('PAID');
        request.flush([]);

        TestBed.inject(AdminApiService);
        api['http'].get('/api/quotes/options').subscribe();
        const publicRequest = http.expectOne('/api/quotes/options');
        expect(publicRequest.request.headers.has('Authorization')).toBe(false);
        publicRequest.flush({});
    });

    it('forgets rejected credentials', () => {
        auth.login('admin', 'wrong');

        let failed = false;
        api.listOrders().subscribe({ error: () => (failed = true) });
        http.expectOne('/api/admin/orders').flush({ detail: 'Admin credentials required.' }, { status: 401, statusText: 'Unauthorized' });

        expect(failed).toBe(true);
        expect(auth.loggedIn()).toBeNull();
        expect(sessionStorage.getItem('pod.admin')).toBeNull();
    });

    it('posts status changes and downloads models as blobs', () => {
        auth.login('admin', 'secret');

        api.setStatus('POD-1000', 'PRINTING').subscribe();
        const change = http.expectOne('/api/admin/orders/POD-1000/status');
        expect(change.request.body).toEqual({ status: 'PRINTING' });
        change.flush({ orderNumber: 'POD-1000', status: 'PRINTING' });

        let blob: Blob | undefined;
        api.downloadModel('POD-1000', 2).subscribe((b) => (blob = b));
        const download = http.expectOne('/api/admin/orders/POD-1000/items/2/model');
        expect(download.request.responseType).toBe('blob');
        download.flush(new Blob(['solid x']));
        expect(blob?.size).toBe(7);
    });

    it('reads the calibration report with the owner credentials', () => {
        auth.login('admin', 'secret');

        api.getCalibrationReport().subscribe();
        const report = http.expectOne('/api/admin/calibration/report');
        expect(report.request.method).toBe('GET');
        expect(report.request.headers.get('Authorization')).toBe('Basic ' + btoa('admin:secret'));
        report.flush({ models: 0, rows: 0 });
    });

    it('lists the stored slice rows with a limit and an optional source', () => {
        auth.login('admin', 'secret');

        api.getCalibrationRows().subscribe();
        const all = http.expectOne((r) => r.url === '/api/admin/calibration/rows');
        expect(all.request.method).toBe('GET');
        expect(all.request.params.get('limit')).toBe('200');
        expect(all.request.params.has('source')).toBe(false);
        expect(all.request.headers.get('Authorization')).toBe('Basic ' + btoa('admin:secret'));
        all.flush([]);

        api.getCalibrationRows({ limit: 50, source: 'quote' }).subscribe();
        const quotes = http.expectOne((r) => r.url === '/api/admin/calibration/rows');
        expect(quotes.request.params.get('limit')).toBe('50');
        expect(quotes.request.params.get('source')).toBe('quote');
        quotes.flush([]);
    });

    it('downloads the calibration rows as a CSV blob', () => {
        auth.login('admin', 'secret');

        let blob: Blob | undefined;
        api.downloadCalibrationRows().subscribe((b) => (blob = b));
        const download = http.expectOne('/api/admin/calibration/rows.csv');
        expect(download.request.responseType).toBe('blob');
        expect(download.request.headers.get('Authorization')).toBe('Basic ' + btoa('admin:secret'));
        download.flush(new Blob(['model,filament\n'], { type: 'text/csv' }));
        expect(blob?.size).toBe(15);
        expect(blob?.type).toBe('text/csv');
    });
});
