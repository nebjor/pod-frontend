import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
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

describe('OrderStatusComponent', () => {
    let fixture: ComponentFixture<OrderStatusComponent>;
    let component: OrderStatusComponent;
    let find: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        find = vi.fn(() => of(paid));
    });

    async function setup(queryParams: Record<string, string>) {
        await TestBed.configureTestingModule({
            imports: [OrderStatusComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { find } },
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

    it('prefills the form from the mail link and looks the order up right away', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(component.form.getRawValue()).toEqual({ orderNumber: 'POD-1000', email: 'anna@example.com' });
        expect(find).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledWith('POD-1000', 'anna@example.com');
        expect(component.state()).toBe('found');
    });

    it('renders the status timeline, the lines, the totals and the dates', async () => {
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        const steps = element().querySelectorAll('app-order-status-timeline .step');
        expect(Array.from(steps).map((step) => step.textContent?.trim())).toEqual([
            'Neu', 'Bezahlt', 'In Pruefung', 'Freigegeben', 'Im Druck', 'Versendet'
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

    it('reports other failures', async () => {
        find.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
        await setup({ nr: 'POD-1000', email: 'anna@example.com' });

        expect(component.state()).toBe('error');
        expect(element().textContent).toContain('nicht erreichbar');
    });

    it('waits for the customer when the link carries nothing, and validates the form', async () => {
        await setup({});

        expect(find).not.toHaveBeenCalled();
        expect(component.state()).toBe('idle');

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
