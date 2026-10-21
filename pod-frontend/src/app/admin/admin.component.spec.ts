import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminApiService, AdminOrder, AdminOrderItem } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminComponent } from './admin.component';

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

describe('AdminComponent', () => {
    let fixture: ComponentFixture<AdminComponent>;
    let component: AdminComponent;
    let auth: AdminAuthService;
    let listOrders: ReturnType<typeof vi.fn>;
    let setStatus: ReturnType<typeof vi.fn>;
    let downloadModel: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        sessionStorage.clear();
        listOrders = vi.fn(() => of([paidOrder, singleOrder]));
        setStatus = vi.fn((_: string, status: string) => of({ ...paidOrder, status, allowedTransitions: ['APPROVED', 'CANCELLED'] }));
        downloadModel = vi.fn(() => of(new Blob(['solid x'])));

        await TestBed.configureTestingModule({
            imports: [AdminComponent],
            providers: [{ provide: AdminApiService, useValue: { listOrders, setStatus, downloadModel, resetRateLimits: vi.fn() } }]
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
});
