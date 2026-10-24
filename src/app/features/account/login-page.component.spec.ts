import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { CartSyncService } from '@core/cart/cart-sync.service';
import { of, throwError } from 'rxjs';
import { AccountResponse, AccountState, LOGIN_RETURN_TO_STORAGE_KEY } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';
import { LoginPageComponent } from './login-page.component';

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

describe('LoginPageComponent', () => {
    let fixture: ComponentFixture<LoginPageComponent>;
    let component: LoginPageComponent;
    let state: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let redeemToken: ReturnType<typeof vi.fn>;
    let requestLoginLink: ReturnType<typeof vi.fn>;
    let loginWithPassword: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;
    let ensureSynced: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        state = signal<AccountState>('anonymous');
        ensureSynced = vi.fn(() => Promise.resolve());
        account = signal<AccountResponse | null>(null);
        redeemToken = vi.fn(() => {
            account.set(anna);
            state.set('signedIn');
            return of(anna);
        });
        requestLoginLink = vi.fn(() => of(undefined));
        loginWithPassword = vi.fn(() => {
            account.set({ ...anna, hasPassword: true });
            state.set('signedIn');
            return of({ ...anna, hasPassword: true });
        });
    });

    afterEach(() => localStorage.clear());

    const settled = () => new Promise<void>((resolve) => setTimeout(resolve));

    async function setup(queryParams: Record<string, string>) {
        await TestBed.configureTestingModule({
            imports: [LoginPageComponent],
            providers: [
                provideRouter([]),
                {
                    provide: AccountService,
                    useValue: {
                        state,
                        account,
                        isSignedIn: computed(() => state() === 'signedIn'),
                        load: vi.fn(() => Promise.resolve()),
                        redeemToken,
                        requestLoginLink,
                        loginWithPassword
                    }
                },
                { provide: CartSyncService, useValue: { ensureSynced } },
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }) } }
            ]
        }).compileComponents();
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(LoginPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function text() {
        return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    function modeButtons() {
        return Array.from(element().querySelectorAll<HTMLButtonElement>('.mode-switch .mode-btn'));
    }

    function submitButton() {
        return element().querySelector<HTMLButtonElement>('button[type="submit"]');
    }

    function forgotButton() {
        return element().querySelector<HTMLButtonElement>('.forgot-btn');
    }

    describe('token from the mail', () => {
        it('redeems the token and continues to the account page', async () => {
            await setup({ token: 'tok-123' });

            expect(redeemToken).toHaveBeenCalledTimes(1);
            expect(redeemToken).toHaveBeenCalledWith('tok-123');
            expect(navigateByUrl).toHaveBeenCalledWith('/konto');
        });

        it('waits for the account cart before it leaves the page', async () => {
            let finishSync: () => void = () => undefined;
            ensureSynced.mockReturnValue(new Promise<void>((resolve) => (finishSync = resolve)));
            await setup({ token: 'tok-123', returnTo: '/warenkorb' });
            await settled();
            expect(navigateByUrl).not.toHaveBeenCalled();

            finishSync();
            await settled();

            expect(navigateByUrl).toHaveBeenCalledWith('/warenkorb');
        });

        it('returns to the page that asked for the login, when it is a path of this app', async () => {
            await setup({ token: 'tok-123', returnTo: '/checkout' });
            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
        });

        it('follows the next path from the link in the mail after the redeem', async () => {
            await setup({ token: 'tok-123', next: '/konto/passwort' });
            expect(navigateByUrl).toHaveBeenCalledWith('/konto/passwort');
        });

        it('lets an explicit return target win over the next path', async () => {
            await setup({ token: 'tok-123', returnTo: '/checkout', next: '/konto/passwort' });
            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
        });

        it('ignores a next path on another origin', async () => {
            await setup({ token: 'tok-123', next: 'https://evil.example/' });
            expect(navigateByUrl).toHaveBeenCalledWith('/konto');
        });

        it('ignores a return target on another origin', async () => {
            await setup({ token: 'tok-123', returnTo: '//evil.example/' });
            expect(navigateByUrl).toHaveBeenCalledWith('/konto');
        });

        it('uses the return path remembered when the mail was requested', async () => {
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, '/checkout');
            await setup({ token: 'tok-123' });

            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBeNull();
        });

        it('leaves the remembered path to the password page when the mail link points there', async () => {
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, '/checkout');
            await setup({ token: 'tok-123', next: '/konto/passwort' });

            expect(navigateByUrl).toHaveBeenCalledWith('/konto/passwort');
            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBe('/checkout');
        });

        it('offers a new mail in the register mode when the token is invalid', async () => {
            redeemToken.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'invalid-token' } })));
            await setup({ token: 'expired' });

            expect(component.state()).toBe('invalid');
            expect(component.mode()).toBe('register');
            expect(navigateByUrl).not.toHaveBeenCalled();
            expect(text()).toContain('ungültig, abgelaufen oder schon benutzt');
            expect(modeButtons()).toHaveLength(2);
            expect(element().querySelector('input[type="email"]')).not.toBeNull();
            expect(element().querySelector('input[type="password"]')).toBeNull();
        });
    });

    it('skips the page for a customer who is signed in already', async () => {
        state.set('signedIn');
        account.set(anna);
        await setup({ returnTo: '/checkout' });

        expect(redeemToken).not.toHaveBeenCalled();
        expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
    });

    describe('sign-in with the password (default)', () => {
        it('opens on the password form with "Registrieren" as the second mode', async () => {
            await setup({});

            expect(component.mode()).toBe('password');
            expect(element().querySelector('h1')?.textContent?.trim()).toBe('Anmelden');
            const [signIn, register] = modeButtons();
            expect(signIn.textContent?.trim()).toBe('Anmelden');
            expect(signIn.getAttribute('aria-pressed')).toBe('true');
            expect(register.textContent?.trim()).toBe('Registrieren');
            expect(register.getAttribute('aria-pressed')).toBe('false');
            expect(element().querySelector('input[type="email"]')).not.toBeNull();
            expect(element().querySelector<HTMLInputElement>('input[type="password"]')?.getAttribute('autocomplete')).toBe('current-password');
            expect(submitButton()?.textContent?.trim()).toBe('Anmelden');
            expect(forgotButton()?.textContent?.trim()).toBe('Passwort vergessen?');
        });

        it('signs in with e-mail and password and continues', async () => {
            await setup({ returnTo: '/checkout' });
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();
            fixture.detectChanges();
            await settled();

            expect(loginWithPassword).toHaveBeenCalledWith('anna@example.com', 'correct horse battery');
            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
        });

        it('lands on the account page by default', async () => {
            await setup({});
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();
            await settled();

            expect(navigateByUrl).toHaveBeenCalledWith('/konto');
        });

        it('does not sign in without e-mail and password', async () => {
            await setup({});
            component.passwordForm.controls.email.setValue('anna@example.com');

            component.submitPassword();

            expect(loginWithPassword).not.toHaveBeenCalled();
            expect(component.passwordForm.controls.password.touched).toBe(true);
        });

        it('says that e-mail or password is wrong, without telling which', async () => {
            loginWithPassword.mockReturnValue(
                throwError(() => new HttpErrorResponse({ status: 401, error: { code: 'invalid-credentials' } }))
            );
            await setup({});
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'wrong' });

            component.submitPassword();
            fixture.detectChanges();
            await settled();

            expect(component.state()).toBe('form');
            expect(component.passwordError()).toBe('E-Mail oder Passwort stimmt nicht.');
            expect(element().querySelector('.error[role="alert"]')?.textContent).toContain('E-Mail oder Passwort stimmt nicht.');
            expect(component.passwordForm.controls.password.value).toBe('');
            expect(component.passwordForm.controls.email.value).toBe('anna@example.com');
            expect(navigateByUrl).not.toHaveBeenCalled();
        });

        it('reports an unreachable backend on the password form', async () => {
            loginWithPassword.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
            await setup({});
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();

            expect(component.passwordError()).toContain('nicht erreichbar');
        });
    });

    describe('forgotten password', () => {
        it('mails the link for the e-mail typed into the sign-in form and says so', async () => {
            await setup({});
            component.passwordForm.controls.email.setValue('anna@example.com');
            component.passwordError.set('E-Mail oder Passwort stimmt nicht.');
            fixture.detectChanges();

            forgotButton()?.click();
            fixture.detectChanges();

            expect(requestLoginLink).toHaveBeenCalledWith('anna@example.com');
            expect(component.state()).toBe('resetSent');
            expect(component.passwordError()).toBe('');
            expect(text()).toContain('Wir haben dir eine E-Mail geschickt.');
            expect(text()).toContain('Mit dem Link darin legst du ein neues Passwort fest.');
            expect(text()).toContain('anna@example.com');
            expect(text()).toContain('15 Minuten gültig');
            expect(text()).toContain('Spam-Ordner');
            expect(element().querySelector('input[type="password"]')).toBeNull();
        });

        it('asks for the e-mail first when the field is empty or wrong', async () => {
            await setup({});
            component.passwordForm.controls.email.setValue('not-an-address');

            component.forgotPassword();
            fixture.detectChanges();

            expect(requestLoginLink).not.toHaveBeenCalled();
            expect(component.passwordForm.controls.email.touched).toBe(true);
            expect(component.passwordForm.controls.password.touched).toBe(false);
            expect(text()).toContain('Bitte gib eine gültige E-Mail-Adresse ein.');
        });

        it('remembers where to go back to when asked from the checkout', async () => {
            await setup({ returnTo: '/checkout' });
            component.passwordForm.controls.email.setValue('anna@example.com');

            component.forgotPassword();

            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBe('/checkout');
        });

        it('comes back to the sign-in form afterwards', async () => {
            await setup({});
            component.passwordForm.controls.email.setValue('anna@example.com');
            component.forgotPassword();
            fixture.detectChanges();

            element().querySelector<HTMLButtonElement>('.ghost-btn')?.click();
            fixture.detectChanges();

            expect(component.state()).toBe('form');
            expect(component.mode()).toBe('password');
            expect(element().querySelector('input[type="password"]')).not.toBeNull();
        });

        it('reports when the mail could not be sent', async () => {
            requestLoginLink.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
            await setup({});
            component.passwordForm.controls.email.setValue('anna@example.com');

            component.forgotPassword();
            fixture.detectChanges();

            expect(component.state()).toBe('form');
            expect(component.errorMessage()).toContain('nicht erreichbar');
            expect(element().querySelector('.error[role="alert"]')?.textContent).toContain('nicht erreichbar');
        });
    });

    describe('registration', () => {
        it('switches to the register form and keeps the e-mail typed so far', async () => {
            await setup({});
            component.passwordForm.controls.email.setValue('anna@example.com');

            modeButtons()[1].click();
            fixture.detectChanges();

            expect(component.mode()).toBe('register');
            expect(element().querySelector('h1')?.textContent?.trim()).toBe('Registrieren');
            expect(modeButtons()[1].getAttribute('aria-pressed')).toBe('true');
            expect(modeButtons()[0].getAttribute('aria-pressed')).toBe('false');
            expect(component.registerForm.controls.email.value).toBe('anna@example.com');
            expect(element().querySelector('input[type="password"]')).toBeNull();
            expect(element().querySelectorAll('input[type="email"]')).toHaveLength(1);
            expect(submitButton()?.textContent?.trim()).toBe('Registrieren');
            expect(text()).toContain('Du bekommst eine E-Mail mit einem Link. Damit legst du dein Passwort fest und bist angemeldet.');
            expect(forgotButton()).toBeNull();
        });

        it('opens in the register mode with ?mode=register', async () => {
            await setup({ mode: 'register' });

            expect(component.mode()).toBe('register');
            expect(modeButtons()[1].getAttribute('aria-pressed')).toBe('true');
            expect(submitButton()?.textContent?.trim()).toBe('Registrieren');
        });

        it('falls back to the sign-in for any other mode', async () => {
            await setup({ mode: 'magic' });
            expect(component.mode()).toBe('password');
        });

        it('switches back and carries the e-mail along', async () => {
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('anna@example.com');

            modeButtons()[0].click();
            fixture.detectChanges();

            expect(component.mode()).toBe('password');
            expect(component.passwordForm.controls.email.value).toBe('anna@example.com');
            expect(element().querySelector('input[type="password"]')).not.toBeNull();
        });

        it('asks the backend for the mail and tells the customer to check the mailbox', async () => {
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('anna@example.com');

            component.submitRegister();
            fixture.detectChanges();

            expect(requestLoginLink).toHaveBeenCalledWith('anna@example.com');
            expect(component.state()).toBe('sent');
            expect(text()).toContain('Schau in dein Postfach');
            expect(text()).toContain('legst du dein Passwort fest');
            expect(text()).toContain('anna@example.com');
            expect(text()).toContain('15 Minuten gültig');
            expect(text()).toContain('Spam-Ordner');
            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBeNull();
        });

        it('remembers where to go back to when registering from the checkout', async () => {
            await setup({ mode: 'register', returnTo: '/checkout' });
            component.registerForm.controls.email.setValue('anna@example.com');

            component.submitRegister();

            expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBe('/checkout');
        });

        it('does not send without a valid e-mail address', async () => {
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('not-an-address');

            component.submitRegister();

            expect(requestLoginLink).not.toHaveBeenCalled();
            expect(component.registerForm.controls.email.touched).toBe(true);
        });

        it('reports when the mail could not be sent', async () => {
            requestLoginLink.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('anna@example.com');

            component.submitRegister();

            expect(component.state()).toBe('form');
            expect(component.errorMessage()).toContain('nicht erreichbar');
        });

        it('leads from the mailbox hint back to the sign-in form', async () => {
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('anna@example.com');
            component.submitRegister();
            fixture.detectChanges();

            element().querySelector<HTMLButtonElement>('.back-to-login')!.click();
            fixture.detectChanges();

            expect(component.state()).toBe('form');
            expect(component.mode()).toBe('password');
            expect(component.passwordForm.controls.email.value).toBe('anna@example.com');
        });

        it('offers another mail from the mailbox hint', async () => {
            await setup({ mode: 'register' });
            component.registerForm.controls.email.setValue('anna@example.com');
            component.submitRegister();
            fixture.detectChanges();

            const again = element().querySelector<HTMLButtonElement>('.ghost-btn');
            expect(again?.textContent?.trim()).toBe('Neue E-Mail anfordern');
            expect(element().querySelector('.back-to-login')?.textContent?.trim()).toBe('Zurück zur Anmeldung');
            again?.click();
            fixture.detectChanges();

            expect(component.state()).toBe('form');
            expect(component.mode()).toBe('register');
            expect(component.registerForm.controls.email.value).toBe('anna@example.com');
        });
    });
});
