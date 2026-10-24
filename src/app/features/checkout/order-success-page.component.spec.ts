import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountService } from '@core/account/account.service';
import { LAST_ORDER_STORAGE_KEY, OrderResponse } from '@core/order/order.models';
import { QuoteOptions } from '@core/quote/quote.models';
import { QuoteService } from '@core/quote/quote.service';
import { CONFIRMATION_POLL_MS, OrderSuccessPageComponent } from './order-success-page.component';

const unpaid: OrderResponse = {
    orderNumber: 'POD-1000',
    status: 'NEW',
    createdAt: '2026-10-19T09:00:00Z',
    quoteExpiresAt: '2026-11-02T09:00:00Z',
    paidAt: null,
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
    totals: { itemsTotal: 7.85, setupFee: 5, shipping: 9, vatRate: 0, vatAmount: 0, total: 21.85, currency: 'CHF' },
    vatNote: 'No VAT charged: the seller is not VAT registered.',
    paymentUrl: '/pay/mock?session=mock_1'
};
const paid: OrderResponse = { ...unpaid, status: 'PAID', paidAt: '2026-10-19T09:05:00Z', paymentUrl: null };

const options: QuoteOptions = {
    filaments: [],
    qualities: [
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 20
};

describe('OrderSuccessPageComponent', () => {
    let fixture: ComponentFixture<OrderSuccessPageComponent>;
    let component: OrderSuccessPageComponent;
    let find: ReturnType<typeof vi.fn>;

    async function setup(queryParams: Record<string, string>) {
        await TestBed.configureTestingModule({
            imports: [OrderSuccessPageComponent],
            providers: [
                provideRouter([]),
                { provide: QuoteService, useValue: { loadOptions: () => of(options) } },
                { provide: AccountService, useValue: { order: find, load: () => Promise.resolve() } },
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }) } }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(OrderSuccessPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify({ orderNumber: 'POD-1000' }));
        find = vi.fn(() => of(paid));
    });

    afterEach(() => {
        vi.useRealTimers();
        sessionStorage.clear();
    });

    /** The first poll is scheduled, not synchronous; flush it. */
    function loadAndFlush() {
        component.load();
        vi.advanceTimersByTime(0);
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    it('shows the paid order with its lines after the provider confirmed it', async () => {
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(find).toHaveBeenCalledWith('POD-1000');
        expect(component.state()).toBe('paid');
        expect(component.order()?.totals.total).toBe(21.85);

        fixture.detectChanges();
        const lines = element().querySelectorAll('.item-list li');
        expect(lines).toHaveLength(2);
        expect(lines[0].textContent).toContain('2 x benchy.stl');
        expect(lines[0].textContent).toContain('CHF 6.00');
        expect(lines[1].textContent).toContain('PETG White');
        expect(element().textContent).toContain('CHF 21.85');
        expect(element().textContent).toMatch(/Einrichtung\s*CHF 5\.00/);
    });

    it('shows status and quality as labels, never as codes', async () => {
        await setup({ order: 'POD-1000' });
        loadAndFlush();
        fixture.detectChanges();

        expect(element().querySelector('.status-row dd')?.textContent?.trim()).toBe('Bezahlt');
        const lines = element().querySelectorAll('.item-list li');
        expect(lines[0].textContent).toContain('Standard 0.20 mm');
        expect(lines[1].textContent).toContain('Fein 0.12 mm');
        expect(element().textContent).not.toContain('PAID');
        expect(element().textContent).not.toContain('medium');
    });

    it('tells the customer what happens next and links the order under the account', async () => {
        await setup({ order: 'POD-1000' });
        loadAndFlush();
        fixture.detectChanges();

        const steps = element().querySelectorAll('.next-steps li');
        expect(steps).toHaveLength(3);
        expect(steps[0].textContent).toContain('anna@example.com');
        const status = element().querySelector<HTMLAnchorElement>('.next-steps a');
        expect(status?.getAttribute('href')).toBe('/konto/bestellungen/POD-1000');
        expect(status?.textContent?.trim()).toBe('Bestellung POD-1000');
        expect(element().querySelector('a[href^="/konto/anmelden"]')).toBeNull();
    });

    it('keeps asking while the confirmation is pending', async () => {
        find.mockReturnValueOnce(of(unpaid)).mockReturnValueOnce(of(unpaid)).mockReturnValue(of(paid));
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(component.state()).toBe('waiting');
        vi.advanceTimersByTime(CONFIRMATION_POLL_MS * 2);
        expect(find).toHaveBeenCalledTimes(3);
        expect(component.state()).toBe('paid');
    });

    it('reports a cancelled payment with the deadline and a way back to it', async () => {
        find.mockReturnValue(of(unpaid));
        await setup({ order: 'POD-1000', cancelled: '1' });
        loadAndFlush();
        fixture.detectChanges();

        expect(component.state()).toBe('cancelled');
        expect(component.order()?.paymentUrl).toContain('/pay/mock');
        expect(element().textContent).toContain('abgebucht wurde nichts');
        expect(element().textContent).toContain('bis 02.11.2026 gültig');
        expect(element().querySelector<HTMLAnchorElement>('a.order-btn[href="/pay/mock?session=mock_1"]')?.textContent).toContain('Jetzt bezahlen');
    });

    it('cannot show an order without a number in the link or the remembered order', async () => {
        sessionStorage.clear();
        await setup({});
        loadAndFlush();
        fixture.detectChanges();

        expect(find).not.toHaveBeenCalled();
        expect(component.state()).toBe('missing');
        expect(element().querySelector('a[href="/konto/bestellungen"]')).not.toBeNull();
    });

    it('treats a backend error as a missing order', async () => {
        find.mockReturnValue(throwError(() => new Error('404')));
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(component.state()).toBe('missing');
    });
});
