import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountResponse, AccountState } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { QuoteOptions } from '../quote/quote.models';
import { QuoteService } from '../quote/quote.service';
import { OrderStatusComponent } from './order-status.component';
import { OrderResponse } from './order.models';
import { OrderService } from './order.service';

const paid: OrderResponse = {
    orderNumber: 'POD-1000',
    status: 'PAID',
    createdAt: '2026-10-19T09:00:00Z',
    quoteExpiresAt: '2026-11-02T09:00:00Z',
    paidAt: '2026-10-19T09:05:00Z',
    paymentUrl: null,
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    items: [
        {
            position: 1,
            fileName: 'benchy.stl',
            filament: 'PLA',
            color: { code: 'red', label: 'Red', hex: '#d62828', pricePerKgChf: 45 },
            quality: 'medium',
            quantity: 2,
            unitPriceChf: 3,
            setupFeeChf: 5,
            lineTotalChf: 11,
            printTimeSeconds: 3903,
            filamentGrams: 23.1
        },
        {
            position: 2,
            fileName: 'cube.stl',
            filament: 'PETG',
            color: { code: 'white', label: 'White', hex: '#f2f2f2', pricePerKgChf: 45 },
            quality: 'high',
            quantity: 1,
            unitPriceChf: 1.85,
            setupFeeChf: 5,
            lineTotalChf: 6.85,
            printTimeSeconds: 1952,
            filamentGrams: 11.5
        }
    ],
    totals: { itemsTotal: 17.85, shipping: 9, vatRate: 0, vatAmount: 0, total: 26.85, currency: 'CHF' },
    vatNote: 'No VAT charged: the seller is not VAT registered.'
};
const unpaid: OrderResponse = { ...paid, status: 'NEW', paidAt: null, paymentUrl: '/pay/mock?session=mock_1' };
const cancelled: OrderResponse = { ...paid, status: 'CANCELLED', paymentUrl: null };

const anna: AccountResponse = {
    email: 'Anna@Example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    createdAt: '2026-10-01T09:00:00Z',
    lastLoginAt: '2026-10-20T09:00:00Z'
};

/** The catalogue renames nothing here; the page must still show labels, not codes. */
const options: QuoteOptions = {
    filaments: [],
    qualities: [
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 20
};

describe('OrderStatusComponent', () => {
    let fixture: ComponentFixture<OrderStatusComponent>;
    let component: OrderStatusComponent;
    let find: ReturnType<typeof vi.fn>;
    let loadOptions: ReturnType<typeof vi.fn>;
    let accountState: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;

    beforeEach(() => {
        find = vi.fn(() => of(paid));
        loadOptions = vi.fn(() => of(options));
        accountState = signal<AccountState>('anonymous');
        account = signal<AccountResponse | null>(null);
    });

    /** Builds the page afresh; a test may call it twice to look at a second order. */
    async function setup(queryParams: Record<string, string>) {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [OrderStatusComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { find } },
                { provide: QuoteService, useValue: { loadOptions } },
                {
                    provide: AccountService,
                    useValue: {
                        state: accountState,
                        account,
                        isSignedIn: computed(() => accountState() === 'signedIn'),
                        load: () => Promise.resolve()
                    }
                },
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }) } }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(OrderStatusComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    function lookupForm() {
        return element().querySelector('form.lookup-form');
    }

    it('prefills the form from the mail link and looks the order up right away', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(component.form.getRawValue()).toEqual({ orderNumber: 'POD-1000', email: 'anna@example.com' });
        expect(find).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledWith('POD-1000', 'anna@example.com');
        expect(component.state()).toBe('found');
    });

    it('shows the order from the mail link alone, with the form behind "Andere Bestellung anzeigen"', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(lookupForm()).toBeNull();
        expect(element().querySelector('.order')).not.toBeNull();
        const other = element().querySelector<HTMLButtonElement>('.order-links .text-btn');
        expect(other?.textContent?.trim()).toBe('Andere Bestellung anzeigen');
        expect(other?.getAttribute('type')).toBe('button');

        other?.click();
        fixture.detectChanges();

        expect(lookupForm()).not.toBeNull();
        // The order stays on screen; the number is cleared for the next one, the e-mail is kept.
        expect(element().querySelector('.order')).not.toBeNull();
        expect(component.form.getRawValue()).toEqual({ orderNumber: '', email: 'anna@example.com' });
        expect(element().querySelector('.order-links .text-btn')).toBeNull();

        // The next successful lookup hides the form again.
        component.form.controls.orderNumber.setValue('POD-1001');
        component.lookup();
        fixture.detectChanges();
        expect(find).toHaveBeenLastCalledWith('POD-1001', 'anna@example.com');
        expect(lookupForm()).toBeNull();
    });

    it('keeps the form when the lookup fails', async () => {
        find.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
        await setup({ nr: 'POD-9999', email: 'anna@example.com' });

        expect(lookupForm()).not.toBeNull();
        expect(element().querySelector('.order')).toBeNull();
    });

    it('links a signed-in customer to the account page for their own order only', async () => {
        accountState.set('signedIn');
        account.set(anna);
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const link = element().querySelector<HTMLAnchorElement>('.order-links a[href="/konto"]');
        expect(link?.textContent).toContain('Mein Konto');

        find.mockReturnValue(of({ ...paid, customerEmail: 'someone-else@example.com' }));
        await setup({ nr: 'POD-1000', email: 'someone-else@example.com' });
        expect(element().querySelector('.order-links a[href="/konto"]')).toBeNull();
    });

    it('shows no account link to a guest', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });
        expect(element().querySelector('.order-links a[href="/konto"]')).toBeNull();
    });

    it('renders the status timeline, the lines, the totals and the dates', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const steps = element().querySelectorAll('app-order-status-timeline .step');
        expect(Array.from(steps).map((step) => step.textContent?.trim())).toEqual([
            'Neu', 'Bezahlt', 'In Prüfung', 'Freigegeben', 'Im Druck', 'Versendet'
        ]);
        expect(steps[0].classList).toContain('done');
        expect(steps[1].classList).toContain('current');
        expect(steps[1].getAttribute('aria-current')).toBe('step');
        expect(steps[2].classList).not.toContain('done');
        expect(element().querySelector('.status-badge')?.textContent?.trim()).toBe('Bezahlt');

        const rows = element().querySelectorAll('.items-table tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('benchy.stl');
        expect(rows[0].textContent).toContain('PLA Red');
        expect(rows[0].textContent).toContain('CHF 11.00');
        expect(rows[1].textContent).toContain('PETG White');

        const text = element().textContent ?? '';
        expect(text).toContain('CHF 26.85');
        expect(text).toContain('19.10.2026');
        expect(text).toContain('Bezahlt am');
        expect(text).toContain('Keine MWST');
        expect(element().querySelector('a.link-btn')).toBeNull();
    });

    it('shows the quality as its catalogue label, never as the code', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const rows = element().querySelectorAll('.items-table tbody tr');
        expect(rows[0].textContent).toContain('Qualität Standard 0.20 mm');
        expect(rows[1].textContent).toContain('Qualität Fein 0.12 mm');
        expect(element().textContent).not.toContain('medium');
    });

    it('falls back to the built-in labels when the catalogue is not available', async () => {
        loadOptions.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const rows = element().querySelectorAll('.items-table tbody tr');
        expect(rows[0].textContent).toContain('Qualität Standard 0.20 mm');
        expect(element().textContent).not.toContain('medium');
    });

    it('offers the payment link while a new order waits for its payment', async () => {
        find.mockReturnValue(of(unpaid));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const pay = element().querySelector<HTMLAnchorElement>('.pay-now a');
        expect(pay?.textContent).toContain('Jetzt bezahlen');
        expect(pay?.getAttribute('href')).toBe('/pay/mock?session=mock_1');
        expect(element().querySelectorAll('.step')[0].classList).toContain('current');
    });

    it('marks a cancelled order instead of drawing the steps', async () => {
        find.mockReturnValue(of(cancelled));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(element().querySelectorAll('.step')).toHaveLength(0);
        expect(element().querySelector('app-order-status-timeline')?.textContent).toContain('Storniert');
        expect(element().querySelector('.status-badge')?.classList).toContain('cancelled');
    });

    it('explains a 404 without saying which of the two was wrong', async () => {
        find.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
        await setup({ nr: 'POD-9999', email: 'anna@example.com' });

        expect(component.state()).toBe('not-found');
        expect(component.order()).toBeNull();
        expect(element().textContent).toContain('Keine Bestellung mit dieser Nummer und E-Mail gefunden');
    });

    it('reports other failures without status codes', async () => {
        find.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(component.state()).toBe('error');
        expect(element().textContent).toContain('nicht erreichbar');

        find.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(component.state()).toBe('error');
        expect(component.errorMessage()).toContain('nicht geladen werden');
        expect(component.errorMessage()).not.toContain('HTTP');
    });

    it('waits for the customer when the link carries nothing, and validates the form', async () => {
        await setup({});

        expect(find).not.toHaveBeenCalled();
        expect(component.state()).toBe('idle');
        expect(lookupForm()).not.toBeNull();

        component.lookup();
        expect(find).not.toHaveBeenCalled();
        expect(component.form.controls.orderNumber.touched).toBe(true);

        component.form.setValue({ orderNumber: ' POD-1000 ', email: 'anna@example.com' });
        component.lookup();
        expect(find).toHaveBeenCalledWith('POD-1000', 'anna@example.com');
        expect(component.state()).toBe('found');
    });

    it('prefills the order number alone without asking the backend', async () => {
        await setup({ nr: 'POD-1000' });

        expect(component.form.controls.orderNumber.value).toBe('POD-1000');
        expect(find).not.toHaveBeenCalled();
    });
});
