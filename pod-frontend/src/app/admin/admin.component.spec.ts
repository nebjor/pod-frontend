import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminApiService, AdminOrder, AdminOrderItem } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminComponent, RUN_NOW_REFRESH_MS } from './admin.component';
import { CalibrationQueueEntry, CalibrationReport, CalibrationStat } from './calibration.models';

const benchy: AdminOrderItem = {
    position: 1,
    fileName: 'benchy.stl',
    fileSizeBytes: 11257784,
    fileSha256: 'a'.repeat(64),
    filament: 'PLA',
    color: { code: 'red', label: 'Red', hex: '#d62828', pricePerKgChf: 45 },
    quality: 'medium',
    quantity: 2,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    printTimeSeconds: 3903,
    filamentGrams: 23.1,
    unitPriceChf: 3,
    setupFeeChf: 5,
    lineTotalChf: 11,
    warnings: [],
    manifold: true
};

const holder: AdminOrderItem = {
    ...benchy,
    position: 2,
    fileName: 'halter.3mf',
    fileSizeBytes: 524288,
    filament: 'PETG',
    color: { code: 'white', label: 'White', hex: '#f2f2f2', pricePerKgChf: 45 },
    quality: 'high',
    quantity: 1,
    printTimeSeconds: 1952,
    filamentGrams: 11.5,
    unitPriceChf: 1.85,
    lineTotalChf: 6.85
};

const paidOrder: AdminOrder = {
    orderNumber: 'POD-1000',
    status: 'PAID',
    allowedTransitions: ['CANCELLED', 'IN_REVIEW'],
    createdAt: '2026-10-19T09:00:00Z',
    quoteExpiresAt: '2026-11-02T09:00:00Z',
    paidAt: '2026-10-19T09:05:00Z',
    shippedAt: null,
    deleteAfter: null,
    erasedAt: null,
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    items: [benchy, holder],
    totals: { itemsTotal: 17.85, shipping: 9, vatRate: 0, vatAmount: 0, total: 26.85, currency: 'CHF' },
    paymentProvider: 'mock',
    needsInspection: false,
    accountEmail: null
};

const singleOrder: AdminOrder = {
    ...paidOrder,
    orderNumber: 'POD-1001',
    items: [benchy],
    totals: { ...paidOrder.totals, itemsTotal: 11, total: 20 }
};

function stat(median: number, n = 12): CalibrationStat {
    return { n, mean: median, median, min: median - 0.05, max: median + 0.05 };
}

const unmeasured: CalibrationStat = { n: 0, mean: null, median: null, min: null, max: null };

const report: CalibrationReport = {
    models: 2,
    rows: 24,
    configured: { timeFactor: { PETG: 1.38, PCTG: 1.48 }, lengthFactor: { PETG: 0.97, PCTG: 0.97 }, plateOverheadSeconds: 300 },
    timeFactor: {
        PETG: { coarse: stat(1.36), medium: stat(1.37), high: stat(1.5, 3), all: stat(1.38, 27) },
        PCTG: { coarse: unmeasured, medium: unmeasured, high: unmeasured, all: unmeasured }
    },
    lengthFactor: {
        PETG: { coarse: stat(0.97), medium: stat(0.97), high: stat(0.97), all: stat(0.97, 36) },
        PCTG: { coarse: unmeasured, medium: unmeasured, high: unmeasured, all: unmeasured }
    },
    quantity: {
        '4': { n: 12, perCopyRatio: { mean: 0.88, median: 0.88, min: 0.8, max: 0.95 }, plateOverheadSeconds: { mean: 305, median: 300, min: 250, max: 400 } },
        '10': { n: 6, perCopyRatio: { mean: 0.82, median: 0.81, min: 0.75, max: 0.9 }, plateOverheadSeconds: { mean: 330, median: 320, min: 280, max: 410 } }
    },
    arithmeticError: {
        '4': { n: 12, meanAbsPercent: 2.1, maxAbsPercent: 4 },
        '10': { n: 6, meanAbsPercent: 6.4, maxAbsPercent: 9.5 }
    },
    calibratedModels: [
        {
            modelName: 'benchy.stl',
            modelSha256: 'a'.repeat(64),
            source: 'order',
            orderNumber: 'POD-1001',
            measuredAt: '2026-10-22T03:12:00Z',
            cells: 11,
            triangleCount: 225154,
            bbox: { widthMm: 60, depthMm: 31, heightMm: 48 }
        },
        {
            modelName: 'cube.stl',
            modelSha256: 'b'.repeat(64),
            source: 'sample',
            orderNumber: null,
            measuredAt: '2026-10-21T03:05:00Z',
            cells: 12,
            triangleCount: 12,
            bbox: { widthMm: 20, depthMm: 20, heightMm: 20 }
        }
    ]
};

const emptyReport: CalibrationReport = {
    models: 0,
    rows: 0,
    configured: report.configured,
    timeFactor: {},
    lengthFactor: {},
    quantity: {},
    arithmeticError: {},
    calibratedModels: []
};

const queue: CalibrationQueueEntry[] = [
    { id: 4, modelName: 'd.stl', source: 'order', orderNumber: 'POD-1000', queuedAt: '2026-10-21T10:00:00Z', startedAt: null, finishedAt: null, error: null },
    { id: 3, modelName: 'c.stl', source: 'order', orderNumber: 'POD-1000', queuedAt: '2026-10-21T09:00:00Z', startedAt: '2026-10-21T09:30:00Z', finishedAt: null, error: null },
    { id: 2, modelName: 'b.stl', source: 'sample', orderNumber: null, queuedAt: '2026-10-21T08:00:00Z', startedAt: '2026-10-21T08:30:00Z', finishedAt: '2026-10-21T08:45:00Z', error: null },
    { id: 1, modelName: 'a.stl', source: 'order', orderNumber: 'POD-1001', queuedAt: '2026-10-21T07:00:00Z', startedAt: '2026-10-21T07:30:00Z', finishedAt: '2026-10-21T07:31:00Z', error: 'Slicer exited with 1' }
];

describe('AdminComponent', () => {
    let fixture: ComponentFixture<AdminComponent>;
    let component: AdminComponent;
    let auth: AdminAuthService;
    let listOrders: ReturnType<typeof vi.fn>;
    let setStatus: ReturnType<typeof vi.fn>;
    let downloadModel: ReturnType<typeof vi.fn>;
    let getCalibrationReport: ReturnType<typeof vi.fn>;
    let getCalibrationQueue: ReturnType<typeof vi.fn>;
    let enqueueCalibration: ReturnType<typeof vi.fn>;
    let runCalibrationNow: ReturnType<typeof vi.fn>;
    let downloadCalibrationRows: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        sessionStorage.clear();
        listOrders = vi.fn(() => of([paidOrder, singleOrder]));
        setStatus = vi.fn((_: string, status: string) => of({ ...paidOrder, status, allowedTransitions: ['APPROVED', 'CANCELLED'] }));
        downloadModel = vi.fn(() => of(new Blob(['solid x'])));
        getCalibrationReport = vi.fn(() => of(report));
        getCalibrationQueue = vi.fn(() => of(queue));
        enqueueCalibration = vi.fn(() => of(undefined));
        runCalibrationNow = vi.fn(() => of(undefined));
        downloadCalibrationRows = vi.fn(() => of(new Blob(['model,filament\n'], { type: 'text/csv' })));

        await TestBed.configureTestingModule({
            imports: [AdminComponent],
            providers: [
                {
                    provide: AdminApiService,
                    useValue: {
                        listOrders,
                        setStatus,
                        downloadModel,
                        resetRateLimits: vi.fn(),
                        getCalibrationReport,
                        getCalibrationQueue,
                        enqueueCalibration,
                        runCalibrationNow,
                        downloadCalibrationRows
                    }
                }
            ]
        }).compileComponents();

        auth = TestBed.inject(AdminAuthService);
        fixture = TestBed.createComponent(AdminComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    function logIn() {
        component.loginForm.setValue({ username: 'admin', password: 'secret' });
        component.login();
        fixture.detectChanges();
    }

    function host() {
        return fixture.nativeElement as HTMLElement;
    }

    it('asks for credentials when none are remembered', () => {
        expect(component.state()).toBe('login');
        expect(listOrders).not.toHaveBeenCalled();
    });

    it('logs in and lists the orders', () => {
        logIn();

        expect(auth.loggedIn()).toBe('Basic ' + btoa('admin:secret'));
        expect(listOrders).toHaveBeenCalledWith(undefined);
        expect(component.state()).toBe('ready');
        expect(component.orders()).toHaveLength(2);
    });

    it('summarises the lines of each order in the list', () => {
        logIn();

        const rows = host().querySelectorAll('table.orders tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('2 Positionen: benchy.stl, halter.3mf');
        expect(rows[0].textContent).toContain('CHF 26.85');
        expect(rows[1].textContent).toContain('benchy.stl');
        expect(rows[1].textContent).not.toContain('Positionen');
        expect(component.itemSummary(singleOrder)).toBe('benchy.stl');
    });

    it('returns to the login when the backend rejects the credentials', () => {
        listOrders.mockReturnValueOnce(throwError(() => {
            auth.logout(); // what the interceptor does on 401
            return new HttpErrorResponse({ status: 401 });
        }));
        component.loginForm.setValue({ username: 'admin', password: 'wrong' });
        component.login();

        expect(component.state()).toBe('login');
        expect(component.errorMessage()).toContain('Anmeldung fehlgeschlagen');
    });

    it('shows the lines of the selected order with a download per line', () => {
        logIn();
        component.select('POD-1000');
        fixture.detectChanges();

        expect(component.selectedPrintTime()).toBe('1 h 38 min');
        expect(component.selectedFilamentGrams()).toBeCloseTo(34.6);
        const rows = host().querySelectorAll('table.items tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('benchy.stl');
        expect(rows[0].textContent).toContain('10.7 MB');
        expect(rows[0].textContent).toContain('PLA Red');
        expect(rows[0].textContent).toContain('medium (0.2 mm)');
        expect(rows[0].textContent).toContain('CHF 11.00');
        expect((rows[0].querySelector('.swatch-dot') as HTMLElement).style.background).toContain('rgb(214, 40, 40)');
        expect(rows[1].textContent).toContain('halter.3mf');

        (rows[1].querySelector('button') as HTMLButtonElement).click();
        expect(downloadModel).toHaveBeenCalledWith('POD-1000', 2);
    });

    it('leaves the swatch out when a legacy line has no colour hex', () => {
        const legacy: AdminOrder = {
            ...singleOrder,
            items: [{ ...benchy, color: { code: 'red', label: 'Red', hex: null as unknown as string, pricePerKgChf: null as unknown as number } }]
        };
        listOrders.mockReturnValue(of([legacy]));
        logIn();
        component.select('POD-1001');
        fixture.detectChanges();

        const row = host().querySelector('table.items tbody tr');
        expect(row?.querySelector('.swatch-dot')).toBeNull();
        expect(row?.textContent).toContain('PLA Red');
    });

    it('moves an order along the state machine and keeps it selected', () => {
        logIn();
        component.select('POD-1000');

        component.transition(component.selected()!, 'IN_REVIEW');

        expect(setStatus).toHaveBeenCalledWith('POD-1000', 'IN_REVIEW');
        expect(component.selected()?.status).toBe('IN_REVIEW');
        expect(component.selected()?.allowedTransitions).toEqual(['APPROVED', 'CANCELLED']);
        expect(component.notice()).toContain('In Pruefung');
    });

    it('flags an order whose model needs an inspection and lists the slicer warnings', () => {
        const flagged: AdminOrder = {
            ...singleOrder,
            needsInspection: true,
            accountEmail: 'anna@example.com',
            items: [{ ...benchy, manifold: false, warnings: ['Open edges: 12', 'Self-intersecting faces: 3'] }]
        };
        listOrders.mockReturnValue(of([flagged]));
        logIn();

        const row = host().querySelector('table.orders tbody tr');
        expect(row?.classList).toContain('needs-inspection');
        expect(row?.querySelector('.badge.inspect')?.textContent?.trim()).toBe('Pruefen');

        component.select('POD-1001');
        fixture.detectChanges();

        const detail = host().querySelector('.detail');
        expect(detail?.textContent).toContain('Konto');
        expect(detail?.textContent).toContain('anna@example.com');
        const rows = host().querySelectorAll('table.items tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.tag-danger')?.textContent).toBe('nicht wasserdicht');
        const warnings = rows[1].querySelectorAll('.warnings li');
        expect(Array.from(warnings).map((li) => li.textContent)).toEqual(['Open edges: 12', 'Self-intersecting faces: 3']);
    });

    it('tells when the mesh was not checked and stays quiet for a clean one', () => {
        const unchecked: AdminOrder = { ...paidOrder, items: [{ ...benchy, manifold: null }, holder] };
        listOrders.mockReturnValue(of([unchecked]));
        logIn();
        component.select('POD-1000');
        fixture.detectChanges();

        expect(host().querySelector('table.orders tbody tr')?.classList).not.toContain('needs-inspection');
        expect(host().querySelector('.badge.inspect')).toBeNull();
        const rows = host().querySelectorAll('table.items tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.tag-muted')?.textContent).toBe('Mesh nicht geprueft');
        expect(rows[1].querySelector('.tag')).toBeNull();
        expect(host().querySelector('.warnings')).toBeNull();
        expect(host().querySelector('.detail')?.textContent).not.toContain('Konto');
    });

    it('filters by status', () => {
        logIn();

        component.setFilter('SHIPPED');

        expect(listOrders).toHaveBeenLastCalledWith('SHIPPED');
    });

    describe('calibration tab', () => {
        function openCalibration() {
            logIn();
            (host().querySelector('.tabs button:nth-child(2)') as HTMLButtonElement).click();
            fixture.detectChanges();
        }

        it('starts on the orders and loads the report and queue once the tab is opened', () => {
            logIn();
            expect(component.tab()).toBe('orders');
            expect(host().querySelector('h1')?.textContent).toBe('Bestellungen');
            expect(getCalibrationReport).not.toHaveBeenCalled();

            openCalibration();

            expect(component.tab()).toBe('calibration');
            expect(host().querySelector('h1')?.textContent).toBe('Kalibrierung');
            expect(host().querySelector('.tabs button:nth-child(2)')?.classList).toContain('active');
            expect(getCalibrationReport).toHaveBeenCalledTimes(1);
            expect(getCalibrationQueue).toHaveBeenCalledTimes(1);
            expect(host().querySelector('table.orders tbody')).not.toBeNull();
            expect(host().querySelector('.summary')?.textContent).toContain('2 Modelle, 24 Messungen');
            expect(host().querySelector('.summary')?.textContent).toContain('Naechtlich um 03:00, bis zu 5 Modelle pro Nacht');

            component.showTab('orders');
            fixture.detectChanges();
            expect(host().querySelector('.toolbar select')).not.toBeNull();
            expect(host().querySelector('.summary')).toBeNull();
            expect(getCalibrationReport).toHaveBeenCalledTimes(1);
        });

        it('renders the factor tables with medians, sample sizes and deviation highlights', () => {
            openCalibration();

            const tables = host().querySelectorAll('table.factors');
            expect(tables).toHaveLength(2);
            const petg = tables[0].querySelectorAll('tbody tr')[0];
            expect(petg.querySelector('th')?.textContent).toContain('PETG');
            expect(petg.querySelector('th')?.textContent).toContain('konfiguriert 1.38');
            const cells = petg.querySelectorAll('td');
            expect(cells[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('1.36 (n=12)');
            expect(cells[0].classList).not.toContain('deviates');
            // 1.50 against 1.38 is 8.7 % off.
            expect(cells[2].textContent).toContain('1.50');
            expect(cells[2].classList).toContain('deviates');
            expect(cells[3].textContent?.replace(/\s+/g, ' ').trim()).toBe('1.38 (n=27)');

            const pctg = tables[0].querySelectorAll('tbody tr')[1];
            expect(pctg.querySelector('th')?.textContent).toContain('konfiguriert 1.48');
            expect(pctg.querySelectorAll('td')[0].textContent?.trim()).toBe('-');
            expect(pctg.querySelector('td.deviates')).toBeNull();

            const length = tables[1].querySelectorAll('tbody tr')[0];
            expect(length.querySelector('th')?.textContent).toContain('konfiguriert 0.97');
            expect(length.querySelectorAll('td')[3].textContent?.replace(/\s+/g, ' ').trim()).toBe('0.97 (n=36)');
            expect(tables[1].querySelector('td.deviates')).toBeNull();
        });

        it('renders the quantity table and flags a large arithmetic error', () => {
            openCalibration();

            const rows = host().querySelectorAll('table.quantities tbody tr');
            expect(rows).toHaveLength(2);
            const four = rows[0].textContent?.replace(/\s+/g, ' ') ?? '';
            expect(four).toContain('4 (n=12)');
            expect(four).toContain('0.88 (0.80 bis 0.95)');
            expect(four).toContain('300 s (konfiguriert 300 s)');
            expect(four).toContain('2.1 % (max 4.0 %)');
            expect(rows[0].classList).not.toContain('deviates');
            expect(rows[1].textContent).toContain('6.4 %');
            expect(rows[1].classList).toContain('deviates');
            expect(host().textContent).toContain('application.yml');
        });

        it('lists the calibrated models with a link into the order', () => {
            openCalibration();

            const rows = host().querySelectorAll('table.models tbody tr');
            expect(rows).toHaveLength(2);
            const text = rows[0].textContent?.replace(/\s+/g, ' ') ?? '';
            expect(text).toContain('benchy.stl');
            expect(text).toContain('order');
            expect(text).toContain('11');
            expect(text).toContain('225,154');
            expect(text).toContain('60 x 31 x 48 mm');
            expect(rows[1].querySelector('.link-btn')).toBeNull();

            (rows[0].querySelector('.link-btn') as HTMLButtonElement).click();
            fixture.detectChanges();
            expect(component.tab()).toBe('orders');
            expect(component.selected()?.orderNumber).toBe('POD-1001');
            expect(host().querySelector('.detail h2')?.textContent).toContain('POD-1001');
        });

        it('shows the queue with one badge per state and the error text', () => {
            openCalibration();

            const rows = host().querySelectorAll('table.queue tbody tr');
            expect(rows).toHaveLength(4);
            const badges = Array.from(rows).map((row) => row.querySelector('.badge'));
            expect(badges.map((badge) => badge?.textContent?.trim())).toEqual(['wartend', 'laeuft', 'fertig', 'Fehler']);
            expect(badges[0]?.classList).toContain('queue-queued');
            expect(badges[1]?.classList).toContain('queue-running');
            expect(badges[2]?.classList).toContain('queue-done');
            expect(badges[3]?.classList).toContain('queue-failed');
            expect(rows[3].querySelector('.queue-error')?.textContent).toBe('Slicer exited with 1');
            expect(rows[0].querySelector('.queue-error')).toBeNull();
        });

        it('shows the empty state while nothing has been measured', () => {
            getCalibrationReport.mockReturnValue(of(emptyReport));
            getCalibrationQueue.mockReturnValue(of([]));
            openCalibration();

            expect(host().querySelector('.summary')?.textContent).toContain('0 Modelle, 0 Messungen');
            expect(host().querySelector('.empty')?.textContent).toBe('Noch keine Messungen. Nach der naechsten Nacht erscheinen hier die ersten Werte.');
            expect(host().querySelector('table.factors')).toBeNull();
            expect(host().querySelector('table.models')).toBeNull();
            expect(host().textContent).toContain('Warteschlange leer.');
        });

        it('accepts the model list under the models key as well', () => {
            getCalibrationReport.mockReturnValue(of({ ...report, models: report.calibratedModels, calibratedModels: undefined }));
            openCalibration();

            expect(component.modelCount()).toBe(2);
            expect(host().querySelectorAll('table.models tbody tr')).toHaveLength(2);
        });

        it('starts a pass now and reads the queue again after a moment', () => {
            vi.useFakeTimers();
            try {
                openCalibration();
                expect(getCalibrationQueue).toHaveBeenCalledTimes(1);

                (host().querySelector('.toolbar .order-btn') as HTMLButtonElement).click();
                fixture.detectChanges();

                expect(runCalibrationNow).toHaveBeenCalledTimes(1);
                expect(component.notice()).toBe('Kalibrierung gestartet.');
                expect(getCalibrationQueue).toHaveBeenCalledTimes(1);
                vi.advanceTimersByTime(RUN_NOW_REFRESH_MS);
                expect(getCalibrationQueue).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('exports the rows as a CSV download', () => {
            const createObjectURL = vi.fn(() => 'blob:rows');
            URL.createObjectURL = createObjectURL;
            URL.revokeObjectURL = vi.fn();
            openCalibration();

            const buttons = Array.from(host().querySelectorAll('.toolbar button'));
            (buttons.find((button) => button.textContent?.trim() === 'CSV exportieren') as HTMLButtonElement).click();

            expect(downloadCalibrationRows).toHaveBeenCalledTimes(1);
            expect(createObjectURL).toHaveBeenCalledTimes(1);
        });

        it('shows the error of a failed report load and keeps the login on a 401', () => {
            getCalibrationReport.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Report kaputt' } })));
            openCalibration();

            expect(component.calibrationState()).toBe('error');
            expect(host().querySelector('.error')?.textContent).toContain('Report kaputt');
            expect(component.state()).toBe('ready');

            getCalibrationReport.mockReturnValueOnce(throwError(() => {
                auth.logout();
                return new HttpErrorResponse({ status: 401 });
            }));
            component.loadCalibration();
            expect(component.state()).toBe('login');
        });

        it('puts an order line on the queue from the order detail', () => {
            logIn();
            component.select('POD-1000');
            fixture.detectChanges();

            const row = host().querySelectorAll('table.items tbody tr')[1];
            const buttons = Array.from(row.querySelectorAll('button'));
            expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Download', 'Kalibrieren']);

            buttons[1].click();
            fixture.detectChanges();

            expect(enqueueCalibration).toHaveBeenCalledWith('POD-1000', 2);
            expect(row.querySelector('.tag')?.textContent).toBe('In Warteschlange');
            expect(row.querySelectorAll('button')).toHaveLength(1);
            expect(component.notice()).toContain('halter.3mf');
            // The queue was never loaded, so there is nothing to refresh yet.
            expect(getCalibrationQueue).not.toHaveBeenCalled();
        });
    });
});
