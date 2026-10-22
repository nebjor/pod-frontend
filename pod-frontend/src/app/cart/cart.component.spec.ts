import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FALLBACK_ORDER_SETTINGS } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { QuoteOptions, QuoteResponse } from '../quote/quote.models';
import { QuoteService } from '../quote/quote.service';
import { CART_REQUOTE_DEBOUNCE_MS, CartComponent } from './cart.component';
import { AccountService } from '../account/account.service';
import { AccountCartApi } from './account-cart.api';
import { CartSyncService } from './cart-sync.service';
import { CartService, NewCartItem } from './cart.service';

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
    unitPriceChf: 3,
    totalPriceChf: 6,
    currency: 'CHF',
    leadTimeDays: 3,
    warnings: [],
    manifold: true
};

const options: QuoteOptions = {
    filaments: [],
    qualities: [{ code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 }],
    maxQuantity: 20
};

function item(name: string, overrides: Partial<NewCartItem> = {}): NewCartItem {
    const file = new File(['solid part endsolid part'], name);
    return {
        file,
        fileName: name,
        sizeBytes: file.size,
        modelId: 'a'.repeat(64),
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 2,
        quote: { ...quote, fileName: name },
        ...overrides
    };
}

describe('CartComponent', () => {
    let fixture: ComponentFixture<CartComponent>;
    let component: CartComponent;
    let cart: CartService;
    const notice = signal<{ dropped: number } | null>(null);
    const signedIn = signal(false);
    let requestQuote: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.useFakeTimers();
        requestQuote = vi.fn(() => of(quote));
        signedIn.set(false);

        await TestBed.configureTestingModule({
            imports: [CartComponent],
            providers: [
                provideRouter([]),
                { provide: QuoteService, useValue: { requestQuote, uploadModel: vi.fn(), loadOptions: () => of(options) } },
                { provide: AccountCartApi, useValue: {} },
                { provide: AccountService, useValue: { isSignedIn: signedIn.asReadonly() } },
                { provide: CartSyncService, useValue: { notice, dismissNotice: () => notice.set(null) } },
                { provide: OrderService, useValue: { loadSettings: () => of(FALLBACK_ORDER_SETTINGS) } }
            ]
        }).compileComponents();
        cart = TestBed.inject(CartService);
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    async function create() {
        fixture = TestBed.createComponent(CartComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        // The persisted cart is read after the first render; the page shows a loading state until then.
        await cart.whenReady();
        fixture.detectChanges();
    }

    function text() {
        return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    it('shows an empty state with a way to the upload page once the persisted cart is read', async () => {
        await create();

        expect(component.ready()).toBe(true);
        expect(text()).toContain('Warenkorb ist leer');
        expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/upload"]')).not.toBeNull();
    });

    it('lists a line from the account cart that has no file here like any other', async () => {
        cart.replaceAll([{ ...item('phone.stl', { file: undefined, modelId: '', sizeBytes: 2048 }), id: 'srv-1', serverId: 'srv-1' }]);
        await create();

        const lines = (fixture.nativeElement as HTMLElement).querySelectorAll('li.item');
        expect(lines).toHaveLength(1);
        expect(lines[0].textContent).toContain('phone.stl');
        expect(lines[0].textContent).toContain('CHF');
    });

    it('tells the customer when the merge left lines out, until it is dismissed', async () => {
        notice.set({ dropped: 2 });
        await create();
        const root = fixture.nativeElement as HTMLElement;

        expect(root.querySelector('.notice')?.textContent).toContain('2 Modelle');

        root.querySelector<HTMLButtonElement>('.notice-close')?.click();
        fixture.detectChanges();
        expect(root.querySelector('.notice')).toBeNull();
    });

    it('lists every line with its configuration and sums the order', async () => {
        cart.add(item('benchy.stl'));
        cart.add(item('cube.stl', { quantity: 1, quote: { ...quote, quantity: 1, totalPriceChf: 1.85 } }));
        await create();

        const lines = (fixture.nativeElement as HTMLElement).querySelectorAll('li.item');
        expect(lines).toHaveLength(2);
        expect(lines[0].textContent).toContain('benchy.stl');
        expect(lines[0].textContent).toContain('PLA');
        expect(lines[0].textContent).toContain('Red');
        expect(lines[0].textContent).toContain('Standard');
        expect(lines[0].textContent).toContain('CHF 6.00');
        expect((lines[0].querySelector('.swatch-dot') as HTMLElement).style.background).toContain('rgb(214, 40, 40)');

        expect(component.itemsTotal()).toBe(7.85);
        expect(component.shipping()).toBe(9);
        expect(component.setupFee()).toBe(5);
        expect(component.total()).toBe(21.85);
        expect(text()).toContain('Positionen (2)');
        expect(text()).toContain('CHF 21.85');
        expect(text()).not.toContain('(einmalig)');
    });

    it('shows the guest setup fee once, between the items and the shipping, and points to the account fee', async () => {
        cart.add(item('benchy.stl'));
        await create();

        const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.summary .details > div')).map((row) =>
            `${row.querySelector('dt')?.textContent?.trim()} ${row.querySelector('dd')?.textContent?.trim()}`
        );
        expect(rows).toEqual(['Positionen (1) CHF 6.00', 'Einrichtung CHF 5.00', 'Versand (Pauschale) CHF 9.00', 'Gesamt CHF 20.00']);
        const hint = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.account-hint a');
        expect(hint?.textContent).toContain('Mit Konto nur CHF 3.00 Einrichtung');
        expect(hint?.getAttribute('href')).toBe('/konto/anmelden');
    });

    it('charges the reduced setup fee to a signed-in customer and drops the account hint', async () => {
        signedIn.set(true);
        cart.add(item('benchy.stl'));
        await create();

        const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.summary .details > div')).map((row) =>
            `${row.querySelector('dt')?.textContent?.trim()} ${row.querySelector('dd')?.textContent?.trim()}`
        );
        expect(rows).toEqual(['Positionen (1) CHF 6.00', 'Einrichtung CHF 3.00', 'Versand (Pauschale) CHF 9.00', 'Gesamt CHF 18.00']);
        expect(component.total()).toBe(18);
        expect((fixture.nativeElement as HTMLElement).querySelector('.account-hint')).toBeNull();
    });

    it('removes a line and recalculates', async () => {
        const first = cart.add(item('benchy.stl'))!;
        cart.add(item('cube.stl', { quote: { ...quote, totalPriceChf: 1.85 } }));
        await create();

        (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.remove-btn')!.click();
        fixture.detectChanges();

        expect(cart.find(first.id)).toBeUndefined();
        expect((fixture.nativeElement as HTMLElement).querySelectorAll('li.item')).toHaveLength(1);
        expect(component.itemsTotal()).toBe(1.85);
    });

    it('re-quotes a line after its quantity settles and shows the new line total', async () => {
        const line = cart.add(item('benchy.stl'))!;
        await create();
        requestQuote.mockReturnValue(of({ ...quote, quantity: 4, totalPriceChf: 17 }));

        component.changeQuantity(line.id, '3');
        component.changeQuantity(line.id, '4');
        expect(component.pending().has(line.id)).toBe(true);
        expect(requestQuote).not.toHaveBeenCalled();

        vi.advanceTimersByTime(CART_REQUOTE_DEBOUNCE_MS);
        fixture.detectChanges();

        expect(requestQuote).toHaveBeenCalledTimes(1);
        expect(requestQuote.mock.calls[0][1]).toMatchObject({ quantity: 4 });
        expect(component.pending().has(line.id)).toBe(false);
        expect(cart.find(line.id)).toMatchObject({ quantity: 4, quote: { totalPriceChf: 17 } });
        expect(text()).toContain('CHF 17.00');
    });

    it('rejects quantities outside the catalogue limit without asking the backend', async () => {
        const line = cart.add(item('benchy.stl'))!;
        await create();

        component.changeQuantity(line.id, '21');
        vi.advanceTimersByTime(CART_REQUOTE_DEBOUNCE_MS);

        expect(requestQuote).not.toHaveBeenCalled();
        expect(component.lineError(line.id)).toContain('zwischen 1 und 20');
        expect(cart.find(line.id)?.quantity).toBe(2);

        component.changeQuantity(line.id, '2');
        expect(component.lineError(line.id)).toBe('');
    });

    it('keeps the old quote and explains when the re-quote fails', async () => {
        const line = cart.add(item('benchy.stl'))!;
        await create();
        requestQuote.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 30 } })));

        component.changeQuantity(line.id, 5);
        vi.advanceTimersByTime(CART_REQUOTE_DEBOUNCE_MS);
        fixture.detectChanges();

        expect(component.pending().has(line.id)).toBe(false);
        expect(component.lineError(line.id)).toContain('Limit erreicht');
        expect(cart.find(line.id)?.quantity).toBe(2);
        expect(text()).toContain('Limit erreicht');
    });

    it('links to the checkout and to the upload page', async () => {
        cart.add(item('benchy.stl'));
        await create();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('a[href="/checkout"]')?.textContent).toContain('Zur Kasse');
        expect(host.querySelector('a[href="/upload"]')?.textContent).toContain('Weiteres Modell hochladen');
    });
});
