import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { AccountResponse, AccountState, LOGIN_RETURN_TO_STORAGE_KEY } from './account.models';
import { AccountService } from './account.service';
import { PasswordComponent } from './password.component';

const anna: AccountResponse = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    createdAt: '2026-10-01T09:00:00Z',
    lastLoginAt: '2026-10-20T09:00:00Z',
    hasPassword: false
};

describe('PasswordComponent', () => {
    let fixture: ComponentFixture<PasswordComponent>;
    let component: PasswordComponent;
    let state: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let cartEmpty: ReturnType<typeof signal<boolean>>;
    let setPassword: ReturnType<typeof vi.fn>;
    let removePassword: ReturnType<typeof vi.fn>;
    let navigate: ReturnType<typeof vi.spyOn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        state = signal<AccountState>('signedIn');
        account = signal<AccountResponse | null>(anna);
        cartEmpty = signal(true);
        setPassword = vi.fn(() => {
            account.update((current) => (current ? { ...current, hasPassword: true } : current));
            return of(undefined);
        });
        removePassword = vi.fn(() => {
            account.update((current) => (current ? { ...current, hasPassword: false } : current));
            return of(undefined);
        });
    });

    async function setup() {
        await TestBed.configureTestingModule({
            imports: [PasswordComponent],
            providers: [
                provideRouter([]),
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account,
                        isSignedIn: computed(() => state() === 'signedIn'),
                        load: vi.fn(() => Promise.resolve()),
                        setPassword,
                        removePassword
                    }
                },
                { provide: CartService, useValue: { isEmpty: cartEmpty } }
            ]
        }).compileComponents();
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(PasswordComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    function text() {
        return element().textContent ?? '';
    }

    it('sends an anonymous visitor to the login page and brings them back afterwards', async () => {
        state.set('anonymous');
        account.set(null);
        await setup();

        expect(navigate).toHaveBeenCalledWith(['/konto/anmelden'], { queryParams: { returnTo: '/konto/passwort' } });
        expect(component.pageState()).toBe('loading');
    });

    afterEach(() => localStorage.clear());

    it('reads as "Passwort festlegen" for a fresh registration and asks for the password twice', async () => {
        await setup();

        expect(element().querySelector('h1')?.textContent?.trim()).toBe('Passwort festlegen');
        expect(text()).toContain('Mit dem Passwort meldest du dich künftig an');
        expect(text()).toContain('Mindestens 10 Zeichen');
        const inputs = element().querySelectorAll<HTMLInputElement>('input[type="password"]');
        expect(inputs).toHaveLength(2);
        expect(inputs[0].getAttribute('autocomplete')).toBe('new-password');
        expect(inputs[1].getAttribute('autocomplete')).toBe('new-password');
        expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent?.trim()).toBe('Passwort speichern');
        expect(text()).not.toContain('Passwort entfernen');
        expect(element().querySelector('.page-footer a[href="/konto"]')).not.toBeNull();
    });

    it('refuses a password shorter than ten characters', async () => {
        await setup();
        component.form.setValue({ password: 'short', confirm: 'short' });

        component.save();
        fixture.detectChanges();

        expect(setPassword).not.toHaveBeenCalled();
        expect(text()).toContain('mindestens 10 Zeichen');
    });

    it('refuses two passwords that differ', async () => {
        await setup();
        component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse batterie' });

        component.save();
        fixture.detectChanges();

        expect(setPassword).not.toHaveBeenCalled();
        expect(component.form.hasError('mismatch')).toBe(true);
        expect(text()).toContain('stimmen nicht überein');
    });

    describe('after the first password is saved', () => {
        it('goes to the landing page when the cart is empty', async () => {
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();
            fixture.detectChanges();

            expect(setPassword).toHaveBeenCalledWith('correct horse battery');
            expect(navigateByUrl).toHaveBeenCalledWith('/');
            expect(component.saved()).toBe(false);
            expect(component.form.getRawValue()).toEqual({ password: '', confirm: '' });
        });

        it('goes to the cart when it has items', async () => {
            cartEmpty.set(false);
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();

            expect(navigateByUrl).toHaveBeenCalledWith('/warenkorb');
        });

        it('goes back to the page that asked for the registration, before anything else', async () => {
            cartEmpty.set(false);
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, '/checkout');
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();

            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBeNull();
        });

        it('ignores a remembered path on another origin', async () => {
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, 'https://evil.example/');
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();

            expect(navigateByUrl).toHaveBeenCalledWith('/');
        });
    });

    it('shows the backend message when it rejects the password', async () => {
        setPassword.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { password: 'must be at most 128 characters' } } }))
        );
        await setup();
        component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

        component.save();
        fixture.detectChanges();

        expect(component.fieldError()).toBe('must be at most 128 characters');
        expect(text()).toContain('must be at most 128 characters');
        expect(component.saved()).toBe(false);
    });

    it('goes to the login when the session has expired meanwhile', async () => {
        setPassword.mockImplementation(() => {
            account.set(null);
            state.set('anonymous');
            return throwError(() => new HttpErrorResponse({ status: 401, error: { code: 'not-logged-in' } }));
        });
        await setup();
        component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

        component.save();

        expect(navigate).toHaveBeenCalledWith(['/konto/anmelden'], { queryParams: { returnTo: '/konto/passwort' } });
    });

    describe('with a password set', () => {
        beforeEach(() => account.set({ ...anna, hasPassword: true }));

        it('reads as the change page and offers to remove the password', async () => {
            await setup();

            expect(element().querySelector('h1')?.textContent?.trim()).toBe('Passwort ändern');
            const trigger = element().querySelector<HTMLButtonElement>('.page-footer .text-btn');
            expect(trigger?.textContent?.trim()).toBe('Passwort entfernen');
            expect(element().querySelector('.danger-zone')).toBeNull();
        });

        it('saves the new password, stays on the page and links back to the account', async () => {
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();
            fixture.detectChanges();

            expect(setPassword).toHaveBeenCalledWith('correct horse battery');
            expect(navigateByUrl).not.toHaveBeenCalled();
            expect(component.saved()).toBe(true);
            expect(text()).toContain('Passwort gespeichert.');
            expect(element().querySelector('.success a[href="/konto"]')).not.toBeNull();
            expect(component.form.getRawValue()).toEqual({ password: '', confirm: '' });
            expect(element().querySelector('h1')?.textContent?.trim()).toBe('Passwort ändern');
        });

        it('goes back to the checkout after a forgotten password was replaced from there', async () => {
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, '/checkout');
            await setup();
            component.form.setValue({ password: 'correct horse battery', confirm: 'correct horse battery' });

            component.save();

            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
            expect(component.saved()).toBe(false);
        });

        it('removes the password only after the confirmation step', async () => {
            await setup();

            component.askRemove();
            fixture.detectChanges();
            expect(removePassword).not.toHaveBeenCalled();
            const confirmation = element().querySelector('.danger-zone')?.textContent ?? '';
            expect(confirmation).toContain('nur noch mit dem Link per E-Mail');

            component.cancelRemove();
            expect(component.confirmingRemove()).toBe(false);

            component.askRemove();
            component.confirmRemove();
            fixture.detectChanges();

            expect(removePassword).toHaveBeenCalledTimes(1);
            expect(component.removed()).toBe(true);
            expect(text()).toContain('Passwort entfernt');
            expect(text()).toContain('ab jetzt per E-Mail-Link');
            expect(element().querySelector('.danger-zone')).toBeNull();
            expect(element().querySelector('h1')?.textContent?.trim()).toBe('Passwort festlegen');
            expect(text()).not.toContain('Passwort entfernen');
        });

        it('reports when removing did not work and keeps the password', async () => {
            removePassword.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'Kurz nicht verfügbar' } })));
            await setup();

            component.askRemove();
            component.confirmRemove();
            fixture.detectChanges();

            expect(component.removeError()).toBe('Kurz nicht verfügbar');
            expect(component.hasPassword()).toBe(true);
            expect(element().querySelector('.danger-zone .error')?.textContent).toContain('Kurz nicht verfügbar');
        });
    });
});
