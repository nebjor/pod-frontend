import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AccountState } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { CartService, NewCartItem } from '../cart/cart.service';
import { QuoteResponse } from '../quote/quote.models';
import { CART_PREVIEW_CLOSE_DELAY_MS, HeaderComponent } from './header.component';

const quote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'black', label: 'Black', hex: '#1f1f1f', pricePerKgChf: 36 },
    quality: 'medium',
    quantity: 2,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    printTimeSeconds: 2239,
    totalPrintTimeSeconds: 4478,
    filamentLengthMm: 7761,
    filamentGrams: 11.6,
    totalFilamentGrams: 23.2,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 5,
    materialCostChf: 0.8,
    setupFeeChf: 5,
    unitPriceChf: 3,
    totalPriceChf: 11,
    currency: 'CHF',
    leadTimeDays: 3,
    warnings: [],
    manifold: true
};

function item(name: string, quantity: number, totalPriceChf: number): NewCartItem {
    const file = new File(['solid part endsolid part'], name);
    return {
        file,
        fileName: name,
        sizeBytes: file.size,
        modelId: 'a'.repeat(64),
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity,
        quote: { ...quote, fileName: name, quantity, totalPriceChf }
    };
}

describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;
    let cart: CartService;
    let accountState: ReturnType<typeof signal<AccountState>>;

    beforeEach(async () => {
        accountState = signal<AccountState>('unknown');
        await TestBed.configureTestingModule({
            imports: [HeaderComponent],
            providers: [provideRouter([]), { provide: AccountService, useValue: { state: accountState } }]
        }).compileComponents();

        cart = TestBed.inject(CartService);
        fixture = TestBed.createComponent(HeaderComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.useRealTimers();
    });

    function cartLink() {
        return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.cart-link');
    }

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('hides the cart indicator while the cart is empty', () => {
        expect(cartLink()).toBeNull();
    });

    it('shows pieces and total once something is in the cart, linking to the cart page', async () => {
        cart.add(item('benchy.stl', 2, 11));
        cart.add(item('cube.stl', 1, 6.85));
        await fixture.whenStable();

        const link = cartLink();
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/warenkorb');
        expect(link?.querySelector('.cart-count')?.textContent?.trim()).toBe('3');
        expect(link?.querySelector('.cart-total')?.textContent).toContain('CHF 17.85');
        expect(link?.getAttribute('aria-label')).toBe('Warenkorb: 3 Stueck, CHF 17.85');
    });

    function accountLink() {
        return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.account-link');
    }

    it('shows no account link until the session is known, so nothing flickers', () => {
        expect(accountLink()).toBeNull();
    });

    it('invites a visitor to sign in', async () => {
        accountState.set('anonymous');
        await fixture.whenStable();

        expect(accountLink()?.textContent?.trim()).toBe('Anmelden');
        expect(accountLink()?.getAttribute('href')).toBe('/konto/anmelden');
    });

    it('links a signed-in customer to the account page', async () => {
        accountState.set('signedIn');
        await fixture.whenStable();

        expect(accountLink()?.textContent?.trim()).toBe('Mein Konto');
        expect(accountLink()?.getAttribute('href')).toBe('/konto');
    });

    it('hides the indicator again when the cart is cleared', async () => {
        cart.add(item('benchy.stl', 2, 11));
        await fixture.whenStable();
        expect(cartLink()).not.toBeNull();

        cart.clear();
        await fixture.whenStable();
        expect(cartLink()).toBeNull();
    });

    describe('cart preview', () => {
        function widget() {
            return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.cart-widget');
        }

        function panel() {
            return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.cart-preview');
        }

        function hover() {
            widget()?.dispatchEvent(new MouseEvent('mouseenter'));
            fixture.detectChanges();
        }

        async function fill(count: number) {
            for (let i = 1; i <= count; i++) {
                cart.add(item(`part-${i}.stl`, i, i * 10));
            }
            await fixture.whenStable();
        }

        it('renders nothing while the cart is empty', () => {
            expect(widget()).toBeNull();
            expect(panel()).toBeNull();
        });

        it('stays hidden until the indicator is hovered or focused', async () => {
            await fill(1);

            expect(panel()).toBeNull();
            expect(cartLink()?.getAttribute('aria-haspopup')).toBe('true');
            expect(cartLink()?.getAttribute('aria-expanded')).toBe('false');
        });

        it('opens on hover with the lines, the subtotal and both buttons', async () => {
            await fill(2);
            hover();

            const open = panel();
            expect(open).not.toBeNull();
            expect(open?.getAttribute('role')).toBe('region');
            expect(open?.getAttribute('aria-label')).toBe('Warenkorb Vorschau');
            expect(cartLink()?.getAttribute('aria-expanded')).toBe('true');

            const rows = open?.querySelectorAll('.preview-item') ?? [];
            expect(rows.length).toBe(2);
            expect(rows[0].querySelector('.preview-name')?.textContent).toBe('part-1.stl');
            expect(rows[0].querySelector('.preview-config')?.textContent?.trim()).toBe('1 Stueck · PLA Black, medium');
            expect(rows[0].querySelector('.preview-price')?.textContent).toContain('CHF 10.00');
            expect((rows[0].querySelector('.swatch-dot') as HTMLElement).style.background).toContain('rgb(31, 31, 31)');
            expect(open?.querySelector('.preview-more')).toBeNull();
            expect(open?.querySelector('.preview-subtotal')?.textContent).toContain('Zwischensumme');
            expect(open?.querySelector('.preview-subtotal')?.textContent).toContain('zzgl. Versand');
            expect(open?.querySelector('.preview-subtotal strong')?.textContent).toContain('CHF 30.00');

            const buttons = open?.querySelectorAll<HTMLAnchorElement>('.preview-btn') ?? [];
            expect(buttons.length).toBe(2);
            expect(buttons[0].textContent?.trim()).toBe('Zum Warenkorb');
            expect(buttons[0].getAttribute('href')).toBe('/warenkorb');
            expect(buttons[1].textContent?.trim()).toBe('Zur Kasse');
            expect(buttons[1].getAttribute('href')).toBe('/checkout');
        });

        it('opens when the indicator receives keyboard focus', async () => {
            await fill(1);

            cartLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();

            expect(panel()).not.toBeNull();
        });

        it('shows four lines and sums up the rest', async () => {
            await fill(6);
            hover();

            expect(panel()?.querySelectorAll('.preview-item').length).toBe(4);
            expect(panel()?.querySelector('.preview-more')?.textContent?.trim()).toBe('+ 2 weitere Positionen');
        });

        it('closes after the grace period once the mouse has left, unless it comes back', async () => {
            await fill(1);
            vi.useFakeTimers();
            hover();

            widget()?.dispatchEvent(new MouseEvent('mouseleave'));
            vi.advanceTimersByTime(CART_PREVIEW_CLOSE_DELAY_MS - 1);
            fixture.detectChanges();
            expect(panel()).not.toBeNull();

            hover();
            vi.advanceTimersByTime(CART_PREVIEW_CLOSE_DELAY_MS * 2);
            fixture.detectChanges();
            expect(panel()).not.toBeNull();

            widget()?.dispatchEvent(new MouseEvent('mouseleave'));
            vi.advanceTimersByTime(CART_PREVIEW_CLOSE_DELAY_MS);
            fixture.detectChanges();
            expect(panel()).toBeNull();
            expect(cartLink()?.getAttribute('aria-expanded')).toBe('false');
        });

        it('closes on Escape', async () => {
            await fill(1);
            hover();

            cartLink()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            fixture.detectChanges();

            expect(panel()).toBeNull();
        });

        it('closes when focus leaves the widget but not when it moves within it', async () => {
            await fill(1);
            cartLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();

            const checkout = panel()?.querySelector<HTMLAnchorElement>('.preview-btn.primary') ?? null;
            cartLink()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: checkout }));
            fixture.detectChanges();
            expect(panel()).not.toBeNull();

            checkout?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
            fixture.detectChanges();
            expect(panel()).toBeNull();
        });

        it('navigates to the cart page when the panel body is clicked', async () => {
            const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
            await fill(1);
            hover();

            panel()?.querySelector<HTMLElement>('.preview-name')?.click();

            expect(navigateByUrl).toHaveBeenCalledTimes(1);
            expect(navigateByUrl).toHaveBeenCalledWith('/warenkorb');
        });

        it('navigates to the checkout when "Zur Kasse" is clicked, not to the cart page', async () => {
            const router = TestBed.inject(Router);
            const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
            await fill(1);
            hover();

            panel()?.querySelector<HTMLAnchorElement>('.preview-btn.primary')?.click();

            expect(navigateByUrl).toHaveBeenCalledTimes(1);
            const [target] = navigateByUrl.mock.calls[0] as [UrlTree | string];
            expect(typeof target === 'string' ? target : router.serializeUrl(target)).toBe('/checkout');
        });
    });
});
