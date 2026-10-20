import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminApiService, AdminOrder } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminComponent } from './admin.component';

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
    fileName: 'benchy.stl',
    fileSizeBytes: 11257784,
    filament: 'PLA',
    colorCode: 'red',
    colorLabel: 'Red',
    quality: 'medium',
    quantity: 2,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    totalPrintTimeSeconds: 3903,
    totalFilamentGrams: 23.1,
    totals: { setupFee: 5, unitPrice: 3, itemsTotal: 11, shipping: 9, vatRate: 0, vatAmount: 0, total: 20, currency: 'CHF' },
    paymentProvider: 'mock'
};

describe('AdminComponent', () => {
    let fixture: ComponentFixture<AdminComponent>;
    let component: AdminComponent;
    let auth: AdminAuthService;
    let listOrders: ReturnType<typeof vi.fn>;
    let setStatus: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        sessionStorage.clear();
        listOrders = vi.fn(() => of([paidOrder]));
        setStatus = vi.fn((_: string, status: string) => of({ ...paidOrder, status, allowedTransitions: ['APPROVED', 'CANCELLED'] }));

        await TestBed.configureTestingModule({
            imports: [AdminComponent],
            providers: [{ provide: AdminApiService, useValue: { listOrders, setStatus, downloadModel: vi.fn(), resetRateLimits: vi.fn() } }]
        }).compileComponents();

        auth = TestBed.inject(AdminAuthService);
        fixture = TestBed.createComponent(AdminComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('asks for credentials when none are remembered', () => {
        expect(component.state()).toBe('login');
        expect(listOrders).not.toHaveBeenCalled();
    });

    it('logs in and lists the orders', () => {
        component.loginForm.setValue({ username: 'admin', password: 'secret' });
        component.login();

        expect(auth.loggedIn()).toBe('Basic ' + btoa('admin:secret'));
        expect(listOrders).toHaveBeenCalledWith(undefined);
        expect(component.state()).toBe('ready');
        expect(component.orders()).toHaveLength(1);
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

    it('moves an order along the state machine and keeps it selected', () => {
        component.loginForm.setValue({ username: 'admin', password: 'secret' });
        component.login();
        component.select('POD-1000');

        component.transition(component.selected()!, 'IN_REVIEW');

        expect(setStatus).toHaveBeenCalledWith('POD-1000', 'IN_REVIEW');
        expect(component.selected()?.status).toBe('IN_REVIEW');
        expect(component.selected()?.allowedTransitions).toEqual(['APPROVED', 'CANCELLED']);
        expect(component.notice()).toContain('In Pruefung');
    });

    it('filters by status', () => {
        component.loginForm.setValue({ username: 'admin', password: 'secret' });
        component.login();

        component.setFilter('SHIPPED');

        expect(listOrders).toHaveBeenLastCalledWith('SHIPPED');
    });
});
