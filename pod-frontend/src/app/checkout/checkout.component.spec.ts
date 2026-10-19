import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CartItem, CartService } from '../cart/cart.service';
import { LAST_ORDER_STORAGE_KEY, OrderResponse } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { QuoteResponse } from '../quote/quote.models';
import { CheckoutComponent, FALLBACK_ORDER_SETTINGS } from './checkout.component';

const quote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'red', label: 'Red', hex: '#d62828' },
    quality: 'medium',
    quantity: 2,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    printTimeSeconds: 1952,
    totalPrintTimeSeconds: 3903,
    filamentLengthMm: 7731,
    filamentGrams: 11.5,
    totalFilamentGrams: 23.1,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 4.35,
    materialCostChf: 0.8,
    setupFeeChf: 5,
    unitPriceChf: 3,
    totalPriceChf: 11,
    currency: 'CHF',
    leadTimeDays: 3
};

const placedOrder: OrderResponse = {
    orderNumber: 'POD-1000',
    status: 'NEW',
    createdAt: '2026-10-19T09:00:00Z',
    quoteExpiresAt: '2026-11-02T09:00:00Z',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    fileName: 'benchy.stl',
    filament: 'PLA',
    colorCode: 'red',
    colorLabel: 'Red',
    quality: 'medium',
    quantity: 2,
    plateCount: 1,
    totalPrintTimeSeconds: 3903,
    totalFilamentGrams: 23.1,
    totals: { setupFee: 5, unitPrice: 3, itemsTotal: 11, shipping: 9, vatRate: 0, vatAmount: 0, total: 20, currency: 'CHF' },
    vatNote: 'No VAT charged: the seller is not VAT registered.',
    paidAt: null,
    paymentUrl: '/pay/mock?session=mock_1&order=POD-1000&amount=20.00&currency=CHF'
};

function cartItem(): CartItem {
    return {
        file: new File(['solid benchy endsolid benchy'], 'benchy.stl'),
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 2,
        quote
    };
}

describe('CheckoutComponent', () => {
    let fixture: ComponentFixture<CheckoutComponent>;
    let component: CheckoutComponent;
    let cart: CartService;
    let placeOrder: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        placeOrder = vi.fn(() => of(placedOrder));

        await TestBed.configureTestingModule({
            imports: [CheckoutComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { placeOrder, loadSettings: () => of(FALLBACK_ORDER_SETTINGS) } }
            ]
        }).compileComponents();

        cart = TestBed.inject(CartService);
    });

    function create() {
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(CheckoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    function fillAddress() {
        component.customerForm.setValue({
            customerName: 'Anna Muster',
            email: 'anna@example.com',
            street: 'Bahnhofstrasse 1',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH'
        });
    }

    it('shows an empty state without a cart item', () => {
        create();

        expect(component.item()).toBeNull();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('kein Modell im Warenkorb');
    });

    it('sums items and flat shipping before ordering', () => {
        cart.set(cartItem());
        create();

        expect(component.itemsTotal()).toBe(11);
        expect(component.shipping()).toBe(9);
        expect(component.total()).toBe(20);
    });

    it('does not submit an incomplete address', () => {
        cart.set(cartItem());
        create();

        component.submit();

        expect(placeOrder).not.toHaveBeenCalled();
        expect(component.customerForm.touched).toBe(true);
    });

    it('places the order with the quote parameters and continues to the payment page', () => {
        const item = cartItem();
        cart.set(item);
        create();
        fillAddress();

        component.submit();

        expect(placeOrder).toHaveBeenCalledTimes(1);
        expect(placeOrder.mock.calls[0][0]).toBe(item.file);
        expect(placeOrder.mock.calls[0][1]).toMatchObject({
            filament: 'PLA',
            color: 'red',
            quality: 'medium',
            quantity: 2,
            expectedTotalChf: 11,
            customerName: 'Anna Muster',
            email: 'anna@example.com',
            country: 'CH'
        });
        expect(component.state()).toBe('placed');
        expect(component.order()?.orderNumber).toBe('POD-1000');
        expect(cart.item()).toBeNull();
        expect(navigateByUrl).toHaveBeenCalledWith('/pay/mock?session=mock_1&order=POD-1000&amount=20.00&currency=CHF');
        expect(JSON.parse(sessionStorage.getItem(LAST_ORDER_STORAGE_KEY) ?? '{}')).toEqual({
            orderNumber: 'POD-1000',
            email: 'anna@example.com'
        });
    });

    it('shows backend field errors next to the form', () => {
        cart.set(cartItem());
        create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { postalCode: 'must not be blank' } } }))
        );

        component.submit();

        expect(component.state()).toBe('idle');
        expect(component.fieldError('postalCode')).toBe('must not be blank');
        expect(component.errorMessage()).toContain('markierten Felder');
    });

    it('asks the customer to accept a recomputed price and then orders with it', () => {
        cart.set(cartItem());
        create();
        fillAddress();
        const newQuote = { ...quote, totalPriceChf: 12.5 };
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 409, error: { currentQuote: newQuote } }))
        );

        component.submit();
        expect(component.priceChangedTo()).toBe(12.5);
        expect(component.itemsTotal()).toBe(12.5);
        expect(component.state()).toBe('idle');

        component.acceptNewPrice();
        expect(placeOrder).toHaveBeenCalledTimes(2);
        expect(placeOrder.mock.calls[1][1].expectedTotalChf).toBe(12.5);
        expect(component.state()).toBe('placed');
    });

    it('explains rate limits like the upload page does', () => {
        cart.set(cartItem());
        create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 30 } }))
        );

        component.submit();

        expect(component.errorMessage()).toContain('Limit erreicht');
    });
});
