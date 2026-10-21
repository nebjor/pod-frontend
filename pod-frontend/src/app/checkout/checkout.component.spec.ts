import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountResponse, AccountState } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { CartService, NewCartItem } from '../cart/cart.service';
import { FALLBACK_ORDER_SETTINGS, LAST_ORDER_STORAGE_KEY, OrderRequest, OrderResponse } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent } from '../quote/quote.service';
import { CheckoutComponent } from './checkout.component';

const quote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'red', label: 'Red', hex: '#d62828', pricePerKgChf: 45 },
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

const cubeQuote: QuoteResponse = {
    ...quote,
    fileName: 'cube.stl',
    filament: 'PETG',
    color: { code: 'white', label: 'White', hex: '#f2f2f2', pricePerKgChf: 45 },
    quality: 'high',
    quantity: 1,
    totalPrintTimeSeconds: 1952,
    unitPriceChf: 1.85,
    totalPriceChf: 6.85
};

const MODEL_ID = 'a'.repeat(64);
const CUBE_MODEL_ID = 'b'.repeat(64);
const FRESH_MODEL_ID = 'c'.repeat(64);

const placedOrder: OrderResponse = {
    orderNumber: 'POD-1000',
    status: 'NEW',
    createdAt: '2026-10-19T09:00:00Z',
    quoteExpiresAt: '2026-11-02T09:00:00Z',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    items: [
        {
            position: 1,
            fileName: 'benchy.stl',
            filament: 'PLA',
            color: quote.color,
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
            color: cubeQuote.color,
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
    paidAt: null,
    paymentUrl: '/pay/mock?session=mock_1&order=POD-1000&amount=26.85&currency=CHF'
};

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

function benchy(): NewCartItem {
    const file = new File(['solid benchy endsolid benchy'], 'benchy.stl');
    return {
        file,
        fileName: 'benchy.stl',
        sizeBytes: file.size,
        modelId: MODEL_ID,
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 2,
        quote
    };
}

function cube(): NewCartItem {
    const file = new File(['solid cube endsolid cube'], 'cube.stl');
    return {
        file,
        fileName: 'cube.stl',
        sizeBytes: file.size,
        modelId: CUBE_MODEL_ID,
        filament: 'PETG',
        color: cubeQuote.color,
        quality: 'high',
        quantity: 1,
        quote: cubeQuote
    };
}

describe('CheckoutComponent', () => {
    let fixture: ComponentFixture<CheckoutComponent>;
    let component: CheckoutComponent;
    let cart: CartService;
    let placeOrder: ReturnType<typeof vi.fn>;
    let uploadModel: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;
    let accountState: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;

    beforeEach(async () => {
        placeOrder = vi.fn(() => of(placedOrder));
        uploadModel = vi.fn(() => of<UploadEvent>({ kind: 'done', model: { modelId: FRESH_MODEL_ID, fileName: 'benchy.stl', sizeBytes: 28 } }));
        accountState = signal<AccountState>('anonymous');
        account = signal<AccountResponse | null>(null);

        await TestBed.configureTestingModule({
            imports: [CheckoutComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { placeOrder, loadSettings: () => of(FALLBACK_ORDER_SETTINGS) } },
                { provide: QuoteService, useValue: { uploadModel, requestQuote: vi.fn() } },
                { provide: AccountService, useValue: { state: accountState, account, load: () => Promise.resolve() } }
            ]
        }).compileComponents();

        cart = TestBed.inject(CartService);
    });

    afterEach(() => sessionStorage.clear());

    /** Renders and waits for the persisted cart to be read, as a customer's browser would. */
    async function create() {
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(CheckoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await cart.whenReady();
        fixture.detectChanges();
    }

    function fillAddress() {
        component.customerForm.setValue({
            customerName: 'Anna Muster',
            email: 'anna@example.com',
            street: 'Bahnhofstrasse 1',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
            termsAccepted: true
        });
    }

    function sentRequest(call = 0): OrderRequest {
        return placeOrder.mock.calls[call][0] as OrderRequest;
    }

    it('shows an empty state without cart lines', async () => {
        await create();

        expect(component.isEmpty()).toBe(true);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('kein Modell im Warenkorb');
    });

    it('lists every line and sums them with the flat shipping before ordering', async () => {
        cart.add(benchy());
        cart.add(cube());
        await create();

        expect(component.itemsTotal()).toBe(17.85);
        expect(component.shipping()).toBe(9);
        expect(component.total()).toBe(26.85);
        const lines = (fixture.nativeElement as HTMLElement).querySelectorAll('.item-list li');
        expect(lines).toHaveLength(2);
        expect(lines[0].textContent).toContain('2 x benchy.stl');
        expect(lines[0].textContent).toContain('CHF 11.00');
        expect(lines[1].textContent).toContain('1 x cube.stl');
        expect(lines[1].textContent).toContain('PETG White');
        expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/warenkorb"]')).not.toBeNull();
    });

    it('invites a visitor to sign in and come back to the checkout', async () => {
        cart.add(benchy());
        await create();

        const hint = (fixture.nativeElement as HTMLElement).querySelector('.account-hint');
        expect(hint?.textContent).toContain('Schon Kunde?');
        expect(hint?.querySelector('a')?.getAttribute('href')).toContain('/konto/anmelden?returnTo=');
        expect(hint?.querySelector('a')?.getAttribute('href')).toContain('checkout');
    });

    it('prefills the address of a signed-in customer and says who is signed in', async () => {
        accountState.set('signedIn');
        account.set(anna);
        cart.add(benchy());
        await create();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.customerForm.getRawValue()).toEqual({
            customerName: 'Anna Muster',
            email: 'anna@example.com',
            street: 'Bahnhofstrasse 1',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
            termsAccepted: false
        });
        const hint = (fixture.nativeElement as HTMLElement).querySelector('.account-hint');
        expect(hint?.textContent).toContain('Angemeldet als');
        expect(hint?.textContent).toContain('anna@example.com');
        expect(hint?.querySelector('a')).toBeNull();
    });

    it('leaves what the customer typed alone when prefilling', async () => {
        accountState.set('signedIn');
        account.set({ ...anna, street: null, postalCode: null });
        cart.add(benchy());
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(CheckoutComponent);
        component = fixture.componentInstance;
        component.customerForm.controls.email.setValue('other@example.com');
        fixture.detectChanges();
        await cart.whenReady();
        await fixture.whenStable();

        const value = component.customerForm.getRawValue();
        expect(value.email).toBe('other@example.com');
        expect(value.customerName).toBe('Anna Muster');
        expect(value.street).toBe('');
        expect(value.postalCode).toBe('');
        expect(value.city).toBe('Zürich');
    });

    it('does not submit without the terms accepted', async () => {
        cart.add(benchy());
        await create();
        fillAddress();
        component.customerForm.controls.termsAccepted.setValue(false);

        component.submit();

        expect(placeOrder).not.toHaveBeenCalled();
        expect(component.customerForm.controls.termsAccepted.touched).toBe(true);
    });

    it('does not submit an incomplete address', async () => {
        cart.add(benchy());
        await create();

        component.submit();

        expect(placeOrder).not.toHaveBeenCalled();
        expect(component.customerForm.touched).toBe(true);
    });

    it('places the order as JSON with every line by model id and continues to the payment page', async () => {
        cart.add(benchy());
        cart.add(cube());
        await create();
        fillAddress();

        component.submit();

        expect(placeOrder).toHaveBeenCalledTimes(1);
        expect(sentRequest()).toEqual({
            customer: {
                name: 'Anna Muster',
                email: 'anna@example.com',
                street: 'Bahnhofstrasse 1',
                postalCode: '8001',
                city: 'Zürich',
                country: 'CH'
            },
            items: [
                { modelId: MODEL_ID, fileName: 'benchy.stl', filament: 'PLA', color: 'red', quality: 'medium', quantity: 2 },
                { modelId: CUBE_MODEL_ID, fileName: 'cube.stl', filament: 'PETG', color: 'white', quality: 'high', quantity: 1 }
            ],
            expectedTotalChf: 17.85
        });
        expect(component.state()).toBe('placed');
        expect(component.order()?.orderNumber).toBe('POD-1000');
        expect(cart.isEmpty()).toBe(true);
        expect(navigateByUrl).toHaveBeenCalledWith('/pay/mock?session=mock_1&order=POD-1000&amount=26.85&currency=CHF');
        expect(JSON.parse(sessionStorage.getItem(LAST_ORDER_STORAGE_KEY) ?? '{}')).toEqual({
            orderNumber: 'POD-1000',
            email: 'anna@example.com'
        });

        fixture.detectChanges();
        const placed = (fixture.nativeElement as HTMLElement).querySelector('.placed');
        expect(placed?.querySelectorAll('.item-list li')).toHaveLength(2);
        expect(placed?.textContent).toContain('CHF 26.85');
    });

    it('shows backend field errors next to the form, nested or flat', async () => {
        cart.add(benchy());
        await create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({
                status: 400,
                error: { errors: { 'customer.postalCode': 'must not be blank', 'customer.name': 'too long', 'items[0].quantity': 'must be at most 20' } }
            }))
        );

        component.submit();

        expect(component.state()).toBe('idle');
        expect(component.fieldError('postalCode')).toBe('must not be blank');
        expect(component.fieldError('customerName')).toBe('too long');
        expect(component.itemErrors()).toEqual(['items[0].quantity: must be at most 20']);
        expect(component.errorMessage()).toContain('markierten Felder');
    });

    it('asks the customer to accept recomputed prices and then orders with them', async () => {
        cart.add(benchy());
        cart.add(cube());
        await create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({
                status: 409,
                error: {
                    code: 'price-changed',
                    currentQuotes: [{ ...quote, totalPriceChf: 12.5 }, cubeQuote],
                    totals: { itemsTotal: 19.35, shipping: 9, vatRate: 0, vatAmount: 0, total: 28.35, currency: 'CHF' }
                }
            }))
        );

        component.submit();
        expect(component.priceChangedTo()).toBe(28.35);
        expect(component.itemsTotal()).toBe(19.35);
        expect(cart.items()[0].quote.totalPriceChf).toBe(12.5);
        expect(component.state()).toBe('idle');

        component.acceptNewPrice();
        expect(placeOrder).toHaveBeenCalledTimes(2);
        expect(sentRequest(1).expectedTotalChf).toBe(19.35);
        expect(component.state()).toBe('placed');
    });

    it('uploads an expired model again and retries the order once', async () => {
        cart.add(benchy());
        cart.add(cube());
        await create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired', itemIndex: 1 } }))
        );

        component.submit();

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect((uploadModel.mock.calls[0][0] as File).name).toBe('cube.stl');
        expect(placeOrder).toHaveBeenCalledTimes(2);
        expect(sentRequest(1).items.map((item) => item.modelId)).toEqual([MODEL_ID, FRESH_MODEL_ID]);
        expect(component.state()).toBe('placed');
    });

    it('names the model when it expires again after the re-upload', async () => {
        cart.add(benchy());
        await create();
        fillAddress();
        placeOrder.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired', itemIndex: 0 } }))
        );

        component.submit();

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(placeOrder).toHaveBeenCalledTimes(2);
        expect(component.state()).toBe('idle');
        expect(component.errorMessage()).toContain('benchy.stl');
        expect(cart.items()).toHaveLength(1);
    });

    it('reports when the re-upload itself fails', async () => {
        cart.add(benchy());
        await create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired', itemIndex: 0 } }))
        );
        uploadModel.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

        component.submit();

        expect(placeOrder).toHaveBeenCalledTimes(1);
        expect(component.state()).toBe('idle');
        expect(component.errorMessage()).toContain('benchy.stl');
    });

    it('explains rate limits like the upload page does', async () => {
        cart.add(benchy());
        await create();
        fillAddress();
        placeOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 30 } }))
        );

        component.submit();

        expect(component.errorMessage()).toContain('Limit erreicht');
    });
});
