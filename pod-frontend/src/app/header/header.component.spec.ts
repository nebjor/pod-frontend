import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AccountResponse, AccountState } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { CartService, NewCartItem } from '../cart/cart.service';
import { QuoteResponse } from '../quote/quote.models';
import { HeaderComponent } from './header.component';
import { HOVER_MENU_CLOSE_DELAY_MS } from './hover-menu.directive';

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
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let logout: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        accountState = signal<AccountState>('unknown');
        account = signal<AccountResponse | null>(null);
        logout = vi.fn(() => of(undefined));
        await TestBed.configureTestingModule({
            imports: [HeaderComponent],
            providers: [provideRouter([]), { provide: AccountService, useValue: { state: accountState, account, logout } }]
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

    it('shows the cart indicator with a zero and no total while the cart is empty', () => {
        const link = cartLink();
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/warenkorb');
        expect(link?.querySelector('.cart-count')?.textContent?.trim()).toBe('0');
        expect(link?.querySelector('.cart-count')?.classList.contains('empty')).toBe(true);
        expect(link?.querySelector('.cart-total')).toBeNull();
        expect(link?.getAttribute('aria-label')).toBe('Warenkorb: leer');
    });

    it('shows pieces and total once something is in the cart, linking to the cart page', async () => {
        cart.add(item('benchy.stl', 2, 11));
        cart.add(item('cube.stl', 1, 6.85));
        await fixture.whenStable();

        const link = cartLink();
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/warenkorb');
        expect(link?.querySelector('.cart-count')?.textContent?.trim()).toBe('3');
        expect(link?.querySelector('.cart-count')?.classList.contains('empty')).toBe(false);
        expect(link?.querySelector('.cart-total')?.textContent).toContain('CHF 17.85');
        expect(link?.getAttribute('aria-label')).toBe('Warenkorb: 3 Stück, CHF 17.85');
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

    it('drops the total and goes back to zero when the cart is cleared', async () => {
        cart.add(item('benchy.stl', 2, 11));
        await fixture.whenStable();
        expect(cartLink()?.querySelector('.cart-total')).not.toBeNull();

        cart.clear();
        await fixture.whenStable();
        expect(cartLink()?.querySelector('.cart-count')?.textContent?.trim()).toBe('0');
        expect(cartLink()?.querySelector('.cart-total')).toBeNull();
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

        it('opens in an empty state with an invitation to upload while the cart is empty', () => {
            expect(panel()).toBeNull();
            hover();

            const open = panel();
            expect(open).not.toBeNull();
            expect(open?.classList.contains('is-empty')).toBe(true);
            expect(open?.querySelector('.preview-empty')?.textContent?.trim()).toBe('Dein Warenkorb ist leer.');
            expect(open?.querySelector('.preview-items')).toBeNull();
            expect(open?.querySelector('.preview-subtotal')).toBeNull();

            const buttons = open?.querySelectorAll<HTMLAnchorElement>('.preview-btn') ?? [];
            expect(buttons.length).toBe(1);
            expect(buttons[0].textContent?.trim()).toBe('Modell hochladen');
            expect(buttons[0].classList.contains('primary')).toBe(true);
            expect(buttons[0].getAttribute('href')).toBe('/upload');
        });

        it('opens the empty state on keyboard focus and closes it on Escape', () => {
            cartLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();
            expect(panel()?.querySelector('.preview-empty')).not.toBeNull();
            expect(cartLink()?.getAttribute('aria-expanded')).toBe('true');

            cartLink()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            fixture.detectChanges();
            expect(panel()).toBeNull();
            expect(cartLink()?.getAttribute('aria-expanded')).toBe('false');
        });

        it('does not treat the empty panel as a link to the cart page', () => {
            const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
            hover();

            panel()?.querySelector<HTMLElement>('.preview-empty')?.click();

            expect(navigateByUrl).not.toHaveBeenCalled();
        });

        it('switches from the empty state to the lines once something is added', async () => {
            hover();
            expect(panel()?.querySelector('.preview-empty')).not.toBeNull();

            await fill(1);
            fixture.detectChanges();
            expect(panel()?.querySelector('.preview-empty')).toBeNull();
            expect(panel()?.querySelectorAll('.preview-item').length).toBe(1);
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
            // The header has no catalogue; the quality still reads as a label, never as the code.
            expect(rows[0].querySelector('.preview-config')?.textContent?.trim()).toBe('1 Stück · PLA Black, Standard 0.20 mm');
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
            vi.advanceTimersByTime(HOVER_MENU_CLOSE_DELAY_MS - 1);
            fixture.detectChanges();
            expect(panel()).not.toBeNull();

            hover();
            vi.advanceTimersByTime(HOVER_MENU_CLOSE_DELAY_MS * 2);
            fixture.detectChanges();
            expect(panel()).not.toBeNull();

            widget()?.dispatchEvent(new MouseEvent('mouseleave'));
            vi.advanceTimersByTime(HOVER_MENU_CLOSE_DELAY_MS);
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

    describe('account menu', () => {
        function widget() {
            return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.account-widget');
        }

        function menu() {
            return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.account-menu');
        }

        function items() {
            return Array.from(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        }

        function hover() {
            widget()?.dispatchEvent(new MouseEvent('mouseenter'));
            fixture.detectChanges();
        }

        async function signIn() {
            account.set({ email: 'kunde@example.com' } as AccountResponse);
            accountState.set('signedIn');
            await fixture.whenStable();
        }

        it('is not offered to a visitor: "Anmelden" stays a plain link', async () => {
            accountState.set('anonymous');
            await fixture.whenStable();

            expect(widget()).toBeNull();
            expect(accountLink()?.getAttribute('aria-haspopup')).toBeNull();
            accountLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();
            expect(menu()).toBeNull();
        });

        it('stays closed until "Mein Konto" is hovered or focused', async () => {
            await signIn();

            expect(menu()).toBeNull();
            expect(accountLink()?.getAttribute('aria-haspopup')).toBe('menu');
            expect(accountLink()?.getAttribute('aria-expanded')).toBe('false');
        });

        it('opens on hover with the e-mail and the three entries', async () => {
            await signIn();
            hover();

            const open = menu();
            expect(open).not.toBeNull();
            expect(open?.getAttribute('role')).toBe('menu');
            expect(open?.getAttribute('aria-label')).toBe('Mein Konto');
            expect(accountLink()?.getAttribute('aria-expanded')).toBe('true');
            expect(open?.querySelector('.account-email')?.textContent?.trim()).toBe('kunde@example.com');

            const entries = items();
            expect(entries.map((entry) => entry.textContent?.trim())).toEqual(['Bestellungen', 'Lieferadresse', 'Konto', 'Abmelden']);
            expect(entries[0].getAttribute('href')).toBe('/konto');
            expect(entries[1].getAttribute('href')).toBe('/konto/adresse');
            expect(entries[2].getAttribute('href')).toBe('/konto/passwort');
            expect(entries[3].tagName).toBe('BUTTON');
            expect(entries[3].getAttribute('type')).toBe('button');
        });

        it('opens when the link receives keyboard focus', async () => {
            await signIn();

            accountLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();

            expect(menu()).not.toBeNull();
        });

        it('moves the focus between the entries with the arrow keys', async () => {
            await signIn();
            accountLink()?.focus();
            accountLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();

            const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
            accountLink()?.dispatchEvent(down);
            expect(down.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(items()[0]);

            items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
            expect(document.activeElement).toBe(items()[3]);
        });

        it('closes after the grace period once the mouse has left', async () => {
            await signIn();
            vi.useFakeTimers();
            hover();

            widget()?.dispatchEvent(new MouseEvent('mouseleave'));
            vi.advanceTimersByTime(HOVER_MENU_CLOSE_DELAY_MS - 1);
            fixture.detectChanges();
            expect(menu()).not.toBeNull();

            vi.advanceTimersByTime(1);
            fixture.detectChanges();
            expect(menu()).toBeNull();
            expect(accountLink()?.getAttribute('aria-expanded')).toBe('false');
        });

        it('closes on Escape and hands the focus back to the link', async () => {
            await signIn();
            hover();
            const focus = vi.spyOn(accountLink() as HTMLAnchorElement, 'focus');

            items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            fixture.detectChanges();

            expect(menu()).toBeNull();
            expect(focus).toHaveBeenCalled();
        });

        it('closes when focus leaves the widget but not when it moves within it', async () => {
            await signIn();
            accountLink()?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            fixture.detectChanges();

            const first = items()[0];
            accountLink()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: first }));
            fixture.detectChanges();
            expect(menu()).not.toBeNull();

            first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
            fixture.detectChanges();
            expect(menu()).toBeNull();
        });

        it('closes when a navigation starts', async () => {
            await signIn();
            hover();

            await TestBed.inject(Router).navigateByUrl('/');
            fixture.detectChanges();

            expect(menu()).toBeNull();
        });

        it('"Abmelden" ends the session and goes to the landing page', async () => {
            const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
            await signIn();
            hover();

            items()[3].click();

            expect(logout).toHaveBeenCalledTimes(1);
            expect(navigateByUrl).toHaveBeenCalledWith('/');
        });

        it('disables "Abmelden" while the request runs and ignores a second click', async () => {
            const pending = new Subject<void>();
            logout.mockReturnValue(pending);
            vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
            await signIn();
            hover();

            items()[3].click();
            fixture.detectChanges();
            expect((items()[3] as HTMLButtonElement).disabled).toBe(true);
            items()[3].click();

            expect(logout).toHaveBeenCalledTimes(1);
        });

        it('stays signed in and usable when the logout fails', async () => {
            logout.mockReturnValue(throwError(() => new Error('offline')));
            const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
            await signIn();
            hover();

            items()[3].click();
            fixture.detectChanges();

            expect(navigateByUrl).not.toHaveBeenCalled();
            expect((items()[3] as HTMLButtonElement).disabled).toBe(false);
        });
    });

    describe('host', () => {
        const realLocation = window.location;

        // The component reads `window.location.hostname` once when it is created; vitest copies
        // the jsdom globals onto `globalThis`, so the property can be swapped for a stub.
        async function createOnHost(hostname: string) {
            Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, hostname } });
            const onHost = TestBed.createComponent(HeaderComponent);
            await onHost.whenStable();
            return onHost.nativeElement as HTMLElement;
        }

        afterEach(() => {
            Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
        });

        it('shows only the brand on the admin host', async () => {
            accountState.set('anonymous');
            const header = await createOnHost('admin.3dburg.ch');

            expect(header.querySelector('.logo')).not.toBeNull();
            expect(header.querySelector('.actions')).toBeNull();
            expect(header.querySelector('.account-link')).toBeNull();
            expect(header.querySelector('.cart-link')).toBeNull();
            expect(header.querySelector('.upload-btn')).toBeNull();
        });

        it('shows the shop widgets on the shop host', async () => {
            accountState.set('anonymous');
            const header = await createOnHost('3dburg.ch');

            expect(header.querySelector('.account-link')?.textContent?.trim()).toBe('Anmelden');
            expect(header.querySelector('.cart-link')).not.toBeNull();
            expect(header.querySelector('.upload-btn')).not.toBeNull();
        });
    });
});
