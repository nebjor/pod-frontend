import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LAST_ORDER_STORAGE_KEY, OrderResponse } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { CONFIRMATION_POLL_MS, OrderSuccessComponent } from './order-success.component';

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
    vatNote: 'No VAT charged: the seller is not VAT registered.',
    paymentUrl: '/pay/mock?session=mock_1'
};
const paid: OrderResponse = { ...unpaid, status: 'PAID', paidAt: '2026-10-19T09:05:00Z', paymentUrl: null };

describe('OrderSuccessComponent', () => {
    let fixture: ComponentFixture<OrderSuccessComponent>;
    let component: OrderSuccessComponent;
    let find: ReturnType<typeof vi.fn>;

    async function setup(queryParams: Record<string, string>) {
        await TestBed.configureTestingModule({
            imports: [OrderSuccessComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { find } },
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }) } }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(OrderSuccessComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify({ orderNumber: 'POD-1000', email: 'anna@example.com' }));
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

    it('shows the paid order with its lines after the provider confirmed it', async () => {
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(find).toHaveBeenCalledWith('POD-1000', 'anna@example.com');
        expect(component.state()).toBe('paid');
        expect(component.order()?.totals.total).toBe(26.85);

        fixture.detectChanges();
        const lines = (fixture.nativeElement as HTMLElement).querySelectorAll('.item-list li');
        expect(lines).toHaveLength(2);
        expect(lines[0].textContent).toContain('2 x benchy.stl');
        expect(lines[0].textContent).toContain('CHF 11.00');
        expect(lines[1].textContent).toContain('PETG White');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('CHF 26.85');
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

    it('reports a cancelled payment with a way back to it', async () => {
        find.mockReturnValue(of(unpaid));
        await setup({ order: 'POD-1000', cancelled: '1' });
        loadAndFlush();

        expect(component.state()).toBe('cancelled');
        expect(component.order()?.paymentUrl).toContain('/pay/mock');
    });

    it('cannot show an order without the remembered e-mail', async () => {
        sessionStorage.clear();
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(find).not.toHaveBeenCalled();
        expect(component.state()).toBe('missing');
    });

    it('treats a backend error as a missing order', async () => {
        find.mockReturnValue(throwError(() => new Error('404')));
        await setup({ order: 'POD-1000' });
        loadAndFlush();

        expect(component.state()).toBe('missing');
    });
});
