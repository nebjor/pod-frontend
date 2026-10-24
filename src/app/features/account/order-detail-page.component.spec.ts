import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AccountService } from '@core/account/account.service';
import { OrderResponse } from '@core/order/order.models';
import { QuoteOptions } from '@core/quote/quote.models';
import { QuoteService } from '@core/quote/quote.service';
import { OrderDetailPageComponent } from './order-detail-page.component';

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
            lineTotalChf: 6,
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
            lineTotalChf: 1.85,
            printTimeSeconds: 1952,
            filamentGrams: 11.5
        }
    ],
    totals: { itemsTotal: 7.85, setupFee: 3, shipping: 9, vatRate: 0, vatAmount: 0, total: 19.85, currency: 'CHF' },
    vatNote: 'No VAT charged: the seller is not VAT registered.'
};
const unpaid: OrderResponse = { ...paid, status: 'NEW', paidAt: null, paymentUrl: '/pay/mock?session=mock_1' };
const cancelled: OrderResponse = { ...paid, status: 'CANCELLED', paymentUrl: null };

/** The catalogue renames nothing here; the page must still show labels, not codes. */
const options: QuoteOptions = {
    filaments: [],
    qualities: [
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 20
};

describe('OrderDetailPageComponent', () => {
    let fixture: ComponentFixture<OrderDetailPageComponent>;
    let component: OrderDetailPageComponent;
    let order: ReturnType<typeof vi.fn>;
    let loadOptions: ReturnType<typeof vi.fn>;
    let signedIn: boolean;

    beforeEach(() => {
        order = vi.fn(() => of(paid));
        loadOptions = vi.fn(() => of(options));
        signedIn = true;
    });

    /** Builds the page afresh for the order number in the URL. */
    async function setup(orderNumber = 'POD-1000') {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [OrderDetailPageComponent],
            providers: [
                provideRouter([]),
                { provide: QuoteService, useValue: { loadOptions } },
                { provide: AccountService, useValue: { order, isSignedIn: () => signedIn } },
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of({ get: (key: string) => (key === 'orderNumber' ? orderNumber : null) }) }
                }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(OrderDetailPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    it('loads the order of the URL from the account and shows it', async () => {
        await setup('POD-1000');

        expect(order).toHaveBeenCalledTimes(1);
        expect(order).toHaveBeenCalledWith('POD-1000');
        expect(component.state()).toBe('found');
        expect(element().querySelector('.order h2')?.textContent).toContain('POD-1000');
    });

    it('has no lookup form: the order is the accounts or it is not shown', async () => {
        await setup();

        expect(element().querySelector('form')).toBeNull();
        expect(element().querySelector('input')).toBeNull();
    });

    it('links back to the list of orders', async () => {
        await setup();

        const link = element().querySelector<HTMLAnchorElement>('.order-links a');
        expect(link?.getAttribute('href')).toBe('/konto/bestellungen');
        expect(link?.textContent).toContain('Alle Bestellungen');
    });

    it('renders the status timeline, the lines, the totals and the dates', async () => {
        await setup();

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
        expect(rows[0].textContent).toContain('CHF 6.00');
        expect(rows[1].textContent).toContain('PETG White');

        const text = element().textContent ?? '';
        expect(text).toContain('CHF 19.85');
        expect(text).toMatch(/Einrichtung\s*CHF 3\.00/);
        expect(text).toContain('19.10.2026');
        expect(text).toContain('Bezahlt am');
        expect(text).toContain('Keine MWST');
        expect(element().querySelector('a.link-btn')).toBeNull();
    });

    it('shows the quality as its catalogue label, never as the code', async () => {
        await setup();

        const rows = element().querySelectorAll('.items-table tbody tr');
        expect(rows[0].textContent).toContain('Qualität Standard 0.20 mm');
        expect(rows[1].textContent).toContain('Qualität Fein 0.12 mm');
        expect(element().textContent).not.toContain('medium');
    });

    it('falls back to the built-in labels when the catalogue is not available', async () => {
        loadOptions.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
        await setup();

        const rows = element().querySelectorAll('.items-table tbody tr');
        expect(rows[0].textContent).toContain('Qualität Standard 0.20 mm');
        expect(element().textContent).not.toContain('medium');
    });

    it('offers the payment link while a new order waits for its payment', async () => {
        order.mockReturnValue(of(unpaid));
        await setup();

        const pay = element().querySelector<HTMLAnchorElement>('.pay-now a');
        expect(pay?.textContent).toContain('Jetzt bezahlen');
        expect(pay?.getAttribute('href')).toBe('/pay/mock?session=mock_1');
        expect(element().querySelectorAll('.step')[0].classList).toContain('current');
    });

    it('marks a cancelled order instead of drawing the steps', async () => {
        order.mockReturnValue(of(cancelled));
        await setup();

        expect(element().querySelectorAll('.step')).toHaveLength(0);
        expect(element().querySelector('app-order-status-timeline')?.textContent).toContain('Storniert');
        expect(element().querySelector('.status-badge')?.classList).toContain('cancelled');
    });

    it('says an order that is not the accounts does not exist', async () => {
        order.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
        await setup('POD-9999');

        expect(component.state()).toBe('not-found');
        expect(component.order()).toBeNull();
        expect(element().textContent).toContain('Diese Bestellung gibt es nicht oder sie gehört nicht zu deinem Konto');
    });

    it('sends a customer whose session ended to the login and back to this order', async () => {
        await setup('POD-1000');
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        signedIn = false;
        order.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

        component.load();

        expect(navigate).toHaveBeenCalledWith(['/konto/anmelden'], {
            queryParams: { returnTo: '/konto/bestellungen/POD-1000' }
        });
    });

    it('reports other failures without status codes and can retry', async () => {
        order.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
        await setup();

        expect(component.state()).toBe('error');
        expect(element().textContent).toContain('nicht erreichbar');

        order.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        component.load();
        fixture.detectChanges();

        expect(component.state()).toBe('error');
        expect(component.errorMessage()).toContain('nicht geladen werden');
        expect(component.errorMessage()).not.toContain('HTTP');

        order.mockReturnValue(of(paid));
        element().querySelector<HTMLButtonElement>('.card button')?.click();
        fixture.detectChanges();
        expect(component.state()).toBe('found');
    });

    it('loads again when the order number in the URL changes and drops the answer of the old one', async () => {
        const params = new BehaviorSubject({ get: (_key: string) => 'POD-1000' as string | null });
        const slow = new Subject<OrderResponse>();
        order.mockImplementation((number: string) => (number === 'POD-1000' ? slow : of({ ...paid, orderNumber: 'POD-1001' })));
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [OrderDetailPageComponent],
            providers: [
                provideRouter([]),
                { provide: QuoteService, useValue: { loadOptions } },
                { provide: AccountService, useValue: { order, isSignedIn: () => true } },
                { provide: ActivatedRoute, useValue: { paramMap: params } }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(OrderDetailPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();

        params.next({ get: () => 'POD-1001' });
        slow.next({ ...paid, orderNumber: 'POD-1000' });
        fixture.detectChanges();

        expect(order).toHaveBeenCalledWith('POD-1001');
        expect(component.order()?.orderNumber).toBe('POD-1001');
        expect(component.state()).toBe('found');
    });

    it('shows an error with a retry, not a spinner, when the session ended', async () => {
        signedIn = false;
        order.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
        await setup('POD-1000');

        expect(component.state()).toBe('error');
        expect(element().querySelector('.spinner')).toBeNull();
        expect(element().textContent).toContain('nicht mehr angemeldet');
    });
});
