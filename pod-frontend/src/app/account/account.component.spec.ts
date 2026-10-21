import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FALLBACK_ORDER_SETTINGS, OrderResponse } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { AccountComponent } from './account.component';
import { AccountResponse, AccountState } from './account.models';
import { AccountService } from './account.service';

const anna: AccountResponse = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zuerich',
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
    totals: { itemsTotal: 17.85, shipping: 9, vatRate: 0, vatAmount: 0, total: 26.85, currency: 'CHF' },
    vatNote: null
};

const newer: OrderResponse = {
    ...older,
    orderNumber: 'POD-1001',
    status: 'PAID',
    createdAt: '2026-10-19T09:00:00Z',
    totals: { ...older.totals, itemsTotal: 11, total: 20 }
};

describe('AccountComponent', () => {
    let fixture: ComponentFixture<AccountComponent>;
    let component: AccountComponent;
    let state: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let orders: ReturnType<typeof vi.fn>;
    let update: ReturnType<typeof vi.fn>;
    let logout: ReturnType<typeof vi.fn>;
    let deleteAccount: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        state = signal<AccountState>('signedIn');
        account = signal<AccountResponse | null>(anna);
        orders = vi.fn(() => of([older, newer]));
        update = vi.fn((address: Partial<AccountResponse>) => {
            const updated = { ...anna, ...address };
            account.set(updated);
            return of(updated);
        });
        logout = vi.fn(() => {
            account.set(null);
            state.set('anonymous');
            return of(undefined);
        });
        deleteAccount = vi.fn(() => {
            account.set(null);
            state.set('anonymous');
            return of(undefined);
        });
    });

    async function setup() {
        await TestBed.configureTestingModule({
            imports: [AccountComponent],
            providers: [
                provideRouter([]),
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account,
                        isSignedIn: computed(() => state() === 'signedIn'),
                        load: vi.fn(() => Promise.resolve()),
                        orders,
                        update,
                        logout,
                        deleteAccount
                    }
                },
                { provide: OrderService, useValue: { loadSettings: () => of(FALLBACK_ORDER_SETTINGS) } }
            ]
        }).compileComponents();
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(AccountComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    it('sends an anonymous visitor to the login page', async () => {
        state.set('anonymous');
        account.set(null);
        await setup();

        expect(navigateByUrl).toHaveBeenCalledWith('/konto/anmelden');
        expect(orders).not.toHaveBeenCalled();
        expect(component.pageState()).toBe('loading');
    });

    it('lists the orders newest first with status, total and a link to the status page', async () => {
        await setup();

        expect(component.pageState()).toBe('ready');
        expect(element().textContent).toContain('Angemeldet als');
        expect(element().textContent).toContain('anna@example.com');

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

    it('says so when there are no orders yet', async () => {
        orders.mockReturnValue(of([]));
        await setup();

        expect(element().textContent).toContain('Noch keine Bestellungen');
        expect(element().querySelector('a[href="/upload"]')).not.toBeNull();
    });

    it('goes to the login when the session has expired meanwhile', async () => {
        orders.mockImplementation(() => {
            account.set(null);
            state.set('anonymous');
            return throwError(() => new HttpErrorResponse({ status: 401 }));
        });
        await setup();

        expect(navigateByUrl).toHaveBeenCalledWith('/konto/anmelden');
    });

    it('fills the address form from the account and saves it', async () => {
        await setup();

        expect(component.addressForm.getRawValue()).toEqual({
            name: 'Anna Muster',
            street: 'Bahnhofstrasse 1',
            postalCode: '8001',
            city: 'Zuerich',
            country: 'CH'
        });

        component.addressForm.controls.street.setValue('Seestrasse 2');
        component.addressForm.controls.postalCode.setValue('8002');
        component.save();
        fixture.detectChanges();

        expect(update).toHaveBeenCalledWith({ name: 'Anna Muster', street: 'Seestrasse 2', postalCode: '8002', city: 'Zuerich', country: 'CH' });
        expect(component.saved()).toBe(true);
        expect(element().textContent).toContain('Adresse gespeichert');
    });

    it('does not save an incomplete address', async () => {
        await setup();
        component.addressForm.controls.city.setValue('');

        component.save();

        expect(update).not.toHaveBeenCalled();
        expect(component.addressForm.controls.city.touched).toBe(true);
    });

    it('shows the backend field errors next to the inputs', async () => {
        update.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { postalCode: 'must be a Swiss postal code' } } }))
        );
        await setup();

        component.save();
        fixture.detectChanges();

        expect(component.fieldError('postalCode')).toBe('must be a Swiss postal code');
        expect(component.errorMessage()).toContain('markierten Felder');
        expect(element().textContent).toContain('must be a Swiss postal code');
    });

    it('logs out and goes to the start page', async () => {
        await setup();

        component.logout();

        expect(logout).toHaveBeenCalled();
        expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('deletes the account only after the confirmation step', async () => {
        await setup();

        // Deletion sits behind a plain text control, not next to the primary actions.
        const trigger = element().querySelector<HTMLButtonElement>('.account-footer .text-btn');
        expect(trigger?.textContent?.trim()).toBe('Konto loeschen');
        expect(element().querySelector('.danger-zone')).toBeNull();

        component.askDelete();
        fixture.detectChanges();
        expect(deleteAccount).not.toHaveBeenCalled();
        const confirmation = element().querySelector('.danger-zone')?.textContent ?? '';
        expect(confirmation).toContain('Dein Konto und deine gespeicherte Adresse werden geloescht');
        expect(confirmation).toContain('Deine Bestellungen bleiben als Geschaeftsunterlagen gespeichert');
        expect(confirmation).toContain('unter "Meine Bestellung" weiterhin einsehen');

        component.cancelDelete();
        expect(component.confirmingDelete()).toBe(false);

        component.askDelete();
        component.confirmDelete();
        fixture.detectChanges();

        expect(deleteAccount).toHaveBeenCalledTimes(1);
        expect(component.pageState()).toBe('deleted');
        expect(element().textContent).toContain('Dein Konto ist geloescht');
        expect(element().querySelector('.error')).toBeNull();
        expect(element().querySelector('a[href="/bestellung"]')).not.toBeNull();
        expect(navigateByUrl).not.toHaveBeenCalled();
    });
});
