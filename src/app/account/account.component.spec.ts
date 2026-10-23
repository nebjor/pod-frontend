import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrderResponse } from '../order/order.models';
import { AccountComponent } from './account.component';
import { AccountResponse, AccountState } from './account.models';
import { AccountService } from './account.service';
import { CartService } from '../cart/cart.service';

const anna: AccountResponse = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    createdAt: '2026-10-01T09:00:00Z',
    lastLoginAt: '2026-10-20T09:00:00Z'
};

const older: OrderResponse = {
    orderNumber: 'POD-1000',
    status: 'SHIPPED',
    createdAt: '2026-10-02T09:00:00Z',
    quoteExpiresAt: '2026-10-16T09:00:00Z',
    paidAt: '2026-10-02T09:05:00Z',
    paymentUrl: null,
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    items: [],
    totals: { itemsTotal: 7.85, setupFee: 5, shipping: 9, vatRate: 0, vatAmount: 0, total: 21.85, currency: 'CHF' },
    vatNote: null
};

const newer: OrderResponse = {
    ...older,
    orderNumber: 'POD-1001',
    status: 'PAID',
    createdAt: '2026-10-19T09:00:00Z',
    totals: { ...older.totals, itemsTotal: 6, total: 20 }
};

describe('AccountComponent', () => {
    let fixture: ComponentFixture<AccountComponent>;
    let component: AccountComponent;
    let state: ReturnType<typeof signal<AccountState>>;
    let orders: ReturnType<typeof vi.fn>;
    let navigate: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        state = signal<AccountState>('signedIn');
        orders = vi.fn(() => of([older, newer]));
    });

    const cartCount = signal(0);

    async function setup() {
        await TestBed.configureTestingModule({
            imports: [AccountComponent],
            providers: [
                provideRouter([]),
                { provide: CartService, useValue: { count: cartCount, itemsTotal: signal(17.5), currency: signal('CHF') } },
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account: signal<AccountResponse | null>(anna),
                        isSignedIn: computed(() => state() === 'signedIn'),
                        orders
                    }
                }
            ]
        }).compileComponents();
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        fixture = TestBed.createComponent(AccountComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    it('lists the orders newest first with status, total and a link to the status page', async () => {
        await setup();

        expect(element().querySelector('h1')?.textContent?.trim()).toBe('Bestellungen');
        const rows = element().querySelectorAll<HTMLAnchorElement>('.order-row');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('POD-1001');
        expect(rows[0].querySelector('.status-badge')?.textContent?.trim()).toBe('Bezahlt');
        expect(rows[0].textContent).toContain('CHF 20.00');
        expect(rows[0].textContent).toContain('19.10.2026');
        expect(rows[0].getAttribute('href')).toContain('/bestellung?');
        expect(rows[0].getAttribute('href')).toContain('nr=POD-1001');
        expect(rows[0].getAttribute('href')).toContain('email=anna');
        expect(rows[1].textContent).toContain('POD-1000');
        expect(rows[1].querySelector('.status-badge')?.textContent?.trim()).toBe('Versendet');
    });

    it('holds only the orders, nothing about address, login, logout or deletion', async () => {
        await setup();

        const text = element().textContent ?? '';
        expect(text).not.toContain('Lieferadresse');
        expect(text).not.toContain('Anmeldung');
        expect(text).not.toContain('Angemeldet als');
        expect(text).not.toContain('Konto löschen');
        expect(element().querySelector('form')).toBeNull();
    });

    it('says so when there are no orders yet', async () => {
        orders.mockReturnValue(of([]));
        await setup();

        expect(element().textContent).toContain('Noch keine Bestellungen');
        expect(element().querySelector('a[href="/upload"]')).not.toBeNull();
    });

    it('points to the checkout when nothing was ordered yet but the cart is filled', async () => {
        orders.mockReturnValue(of([]));
        cartCount.set(2);
        await setup();

        const text = element().textContent ?? '';
        expect(text).toContain('Noch keine Bestellungen');
        expect(text).toContain('2 Stück');
        expect(text).toContain('CHF 17.50');
        expect(element().querySelector('a[href="/checkout"]')?.textContent?.trim()).toBe('Jetzt bestellen');
        expect(element().querySelector('a[href="/warenkorb"]')).toBeNull();
        expect(element().querySelector('a[href="/upload"]')).toBeNull();
        cartCount.set(0);
    });

    it('offers to retry when the orders cannot be loaded', async () => {
        orders.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
        await setup();

        expect(component.ordersState()).toBe('error');
        expect(element().querySelector('.error')?.textContent).toContain('konnten gerade nicht geladen werden');

        component.loadOrders();
        fixture.detectChanges();
        expect(component.ordersState()).toBe('ready');
        expect(element().querySelectorAll('.order-row')).toHaveLength(2);
    });

    it('goes to the login when the session has expired meanwhile', async () => {
        orders.mockImplementation(() => {
            state.set('anonymous');
            return throwError(() => new HttpErrorResponse({ status: 401 }));
        });
        await setup();

        expect(navigate).toHaveBeenCalledWith(['/konto/anmelden'], { queryParams: { returnTo: '/konto' } });
    });
});
