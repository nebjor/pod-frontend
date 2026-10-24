import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { AccountShellComponent } from './account-shell.component';
import { AccountResponse, AccountState } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';

@Component({ template: '<p class="page">orders</p>' })
class OrdersStub {}

@Component({ template: '<p class="page">address</p>' })
class AddressStub {}

@Component({ template: '<p class="page">account</p>' })
class PasswordStub {}

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

describe('AccountShellComponent', () => {
    let state: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let deleted: ReturnType<typeof signal<boolean>>;
    let logout: ReturnType<typeof vi.fn>;
    let harness: RouterTestingHarness;
    let fixture: ComponentFixture<unknown>;

    beforeEach(() => {
        state = signal<AccountState>('signedIn');
        account = signal<AccountResponse | null>(anna);
        deleted = signal(false);
        logout = vi.fn(() => {
            account.set(null);
            state.set('anonymous');
            return of(undefined);
        });
    });

    async function setup(url = '/konto') {
        await TestBed.configureTestingModule({
            providers: [
                provideRouter([
                    { path: 'konto/anmelden', component: OrdersStub },
                    {
                        path: 'konto',
                        component: AccountShellComponent,
                        children: [
                            { path: '', pathMatch: 'full', component: OrdersStub },
                            { path: 'adresse', component: AddressStub },
                            { path: 'passwort', component: PasswordStub }
                        ]
                    },
                    { path: '', component: OrdersStub }
                ]),
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account,
                        deleted,
                        isSignedIn: computed(() => state() === 'signedIn'),
                        load: vi.fn(() => Promise.resolve()),
                        logout
                    }
                }
            ]
        }).compileComponents();
        harness = await RouterTestingHarness.create();
        await harness.navigateByUrl(url);
        fixture = harness.fixture;
        await fixture.whenStable();
        harness.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    function links() {
        return Array.from(element().querySelectorAll<HTMLAnchorElement>('.nav-link'));
    }

    it('lists Bestellungen, Lieferadresse and Konto in the sidebar', async () => {
        await setup();

        expect(links().map((link) => link.textContent?.trim())).toEqual(['Bestellungen', 'Lieferadresse', 'Konto']);
        expect(links().map((link) => link.getAttribute('href'))).toEqual(['/konto', '/konto/adresse', '/konto/passwort']);
        expect(element().querySelector('nav')?.getAttribute('aria-label')).toBe('Konto');
    });

    it('marks only the orders item on /konto', async () => {
        await setup('/konto');

        expect(links().map((link) => link.classList.contains('active'))).toEqual([true, false, false]);
        expect(links()[0].getAttribute('aria-current')).toBe('page');
        expect(links()[1].hasAttribute('aria-current')).toBe(false);
        expect(element().querySelector('.page')?.textContent).toBe('orders');
    });

    it('marks the address and account items on their own paths', async () => {
        await setup('/konto/adresse');
        expect(links().map((link) => link.classList.contains('active'))).toEqual([false, true, false]);
        expect(links()[1].getAttribute('aria-current')).toBe('page');
        expect(element().querySelector('.page')?.textContent).toBe('address');

        await harness.navigateByUrl('/konto/passwort');
        harness.detectChanges();
        expect(links().map((link) => link.classList.contains('active'))).toEqual([false, false, true]);
        expect(element().querySelector('.page')?.textContent).toBe('account');
    });

    it('shows the e-mail and logs out to the start page', async () => {
        await setup();
        const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

        expect(element().querySelector('.signed-in')?.textContent).toContain('anna@example.com');
        const button = element().querySelector<HTMLButtonElement>('.signed-in button');
        expect(button?.textContent?.trim()).toBe('Abmelden');

        button?.click();

        expect(logout).toHaveBeenCalled();
        expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('says so when logging out failed', async () => {
        logout.mockReturnValue(throwError(() => new Error('offline')));
        await setup();

        element().querySelector<HTMLButtonElement>('.signed-in button')?.click();
        harness.detectChanges();

        expect(element().querySelector('.error')?.textContent).toContain('Abmelden hat nicht geklappt');
    });

    it('sends an anonymous visitor to the login and brings them back to the page they asked for', async () => {
        state.set('anonymous');
        account.set(null);
        await setup('/konto/adresse');

        const router = TestBed.inject(Router);
        expect(router.url.startsWith('/konto/anmelden')).toBe(true);
        expect(router.url).toContain('returnTo=%2Fkonto%2Fadresse');
    });

    it('shows a neutral loading card and no sidebar until the session is known', async () => {
        await TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account,
                        deleted,
                        isSignedIn: computed(() => false),
                        load: vi.fn(() => new Promise<void>(() => undefined))
                    }
                }
            ]
        }).compileComponents();
        const pending = TestBed.createComponent(AccountShellComponent);
        pending.detectChanges();

        const root = pending.nativeElement as HTMLElement;
        expect(root.textContent).toContain('Konto wird geladen');
        expect(root.querySelector('.nav-link')).toBeNull();
    });

    it('shows the farewell card instead of the sidebar once the account is deleted', async () => {
        await setup('/konto/passwort');

        deleted.set(true);
        account.set(null);
        state.set('anonymous');
        harness.detectChanges();

        expect(element().textContent).toContain('Dein Konto ist gelöscht');
        expect(element().querySelector('a[href="/bestellung"]')).not.toBeNull();
        expect(element().querySelector('.nav-link')).toBeNull();
    });
});
