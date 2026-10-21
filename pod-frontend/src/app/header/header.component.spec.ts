import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountState } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { CartService, NewCartItem } from '../cart/cart.service';
import { QuoteResponse } from '../quote/quote.models';
import { HeaderComponent } from './header.component';

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

    afterEach(() => sessionStorage.clear());

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
});
