import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountResponse, AccountState, LOGIN_RETURN_TO_STORAGE_KEY } from './account.models';
import { AccountService } from './account.service';
import { LoginComponent } from './login.component';

const anna: AccountResponse = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zuerich',
    country: 'CH',
    createdAt: '2026-10-01T09:00:00Z',
    lastLoginAt: '2026-10-20T09:00:00Z'
};

describe('LoginComponent', () => {
    let fixture: ComponentFixture<LoginComponent>;
    let component: LoginComponent;
    let state: ReturnType<typeof signal<AccountState>>;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let redeemToken: ReturnType<typeof vi.fn>;
    let requestLoginLink: ReturnType<typeof vi.fn>;
    let loginWithPassword: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        state = signal<AccountState>('anonymous');
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

    async function setup(queryParams: Record<string, string>) {
        await TestBed.configureTestingModule({
            imports: [LoginComponent],
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
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }) } }
            ]
        }).compileComponents();
        navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        fixture = TestBed.createComponent(LoginComponent);
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

    it('redeems the token from the mail and continues to the account page', async () => {
        await setup({ token: 'tok-123' });

        expect(redeemToken).toHaveBeenCalledTimes(1);
        expect(redeemToken).toHaveBeenCalledWith('tok-123');
        expect(navigateByUrl).toHaveBeenCalledWith('/konto');
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

    it('uses the return path remembered when the link was requested', async () => {
        localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, '/checkout');
        await setup({ token: 'tok-123' });

        expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
        expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBeNull();
    });

    it('offers a new link when the token is invalid', async () => {
        redeemToken.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'invalid-token' } })));
        await setup({ token: 'expired' });

        expect(component.state()).toBe('invalid');
        expect(navigateByUrl).not.toHaveBeenCalled();
        expect(text()).toContain('ungueltig, abgelaufen oder schon benutzt');
        expect((fixture.nativeElement as HTMLElement).querySelector('input[type="email"]')).not.toBeNull();
    });

    it('sends the login link and says so, without telling whether the address is known', async () => {
        await setup({});
        component.form.controls.email.setValue('anna@example.com');

        component.submit();
        fixture.detectChanges();

        expect(requestLoginLink).toHaveBeenCalledWith('anna@example.com');
        expect(component.state()).toBe('sent');
        expect(text()).toContain('Dein Anmeldelink ist unterwegs');
        expect(text()).toContain('anna@example.com');
        expect(text()).toContain('15 Minuten gueltig');
        expect(text()).toContain('Spam-Ordner');
        expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBeNull();
    });

    it('remembers where to go back to when the link is requested from the checkout', async () => {
        await setup({ returnTo: '/checkout' });
        component.form.controls.email.setValue('anna@example.com');

        component.submit();

        expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBe('/checkout');
    });

    it('does not send without a valid e-mail address', async () => {
        await setup({});
        component.form.controls.email.setValue('not-an-address');

        component.submit();

        expect(requestLoginLink).not.toHaveBeenCalled();
        expect(component.form.controls.email.touched).toBe(true);
    });

    it('reports when the link could not be sent', async () => {
        requestLoginLink.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
        await setup({});
        component.form.controls.email.setValue('anna@example.com');

        component.submit();

        expect(component.state()).toBe('form');
        expect(component.errorMessage()).toContain('nicht erreichbar');
    });

    it('skips the page for a customer who is signed in already', async () => {
        state.set('signedIn');
        account.set(anna);
        await setup({ returnTo: '/checkout' });

        expect(redeemToken).not.toHaveBeenCalled();
        expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
    });

    describe('password login', () => {
        it('starts with the mail link and offers the password as the second way', async () => {
            await setup({});

            const [link, password] = modeButtons();
            expect(link.textContent?.trim()).toBe('Link per E-Mail');
            expect(link.getAttribute('aria-pressed')).toBe('true');
            expect(password.textContent?.trim()).toBe('Passwort');
            expect(password.getAttribute('aria-pressed')).toBe('false');
            expect(element().querySelector('input[type="password"]')).toBeNull();
            expect(element().querySelector('input[type="email"]')).not.toBeNull();
        });

        it('switches to the password form and keeps the e-mail typed so far', async () => {
            await setup({});
            component.form.controls.email.setValue('anna@example.com');

            modeButtons()[1].click();
            fixture.detectChanges();

            expect(component.mode()).toBe('password');
            expect(component.passwordForm.controls.email.value).toBe('anna@example.com');
            const password = element().querySelector<HTMLInputElement>('input[type="password"]');
            expect(password?.getAttribute('autocomplete')).toBe('current-password');
            expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent?.trim()).toBe('Anmelden');
            expect(modeButtons()[1].getAttribute('aria-pressed')).toBe('true');
        });

        it('signs in with e-mail and password and continues', async () => {
            await setup({ returnTo: '/checkout' });
            component.switchMode('password');
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();
            fixture.detectChanges();

            expect(loginWithPassword).toHaveBeenCalledWith('anna@example.com', 'correct horse battery');
            expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
        });

        it('lands on the account page by default', async () => {
            await setup({});
            component.switchMode('password');
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();

            expect(navigateByUrl).toHaveBeenCalledWith('/konto');
        });

        it('does not sign in without e-mail and password', async () => {
            await setup({});
            component.switchMode('password');
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
            component.switchMode('password');
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'wrong' });

            component.submitPassword();
            fixture.detectChanges();

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
            component.switchMode('password');
            component.passwordForm.setValue({ email: 'anna@example.com', password: 'correct horse battery' });

            component.submitPassword();

            expect(component.passwordError()).toContain('nicht erreichbar');
        });

        it('offers the mail link for a forgotten password and keeps the e-mail', async () => {
            await setup({});
            component.switchMode('password');
            component.passwordForm.controls.email.setValue('anna@example.com');
            component.passwordError.set('E-Mail oder Passwort stimmt nicht.');
            fixture.detectChanges();

            expect(text()).toContain('Passwort vergessen?');
            const forgot = element().querySelector<HTMLButtonElement>('.note .text-btn');
            expect(forgot?.textContent?.trim()).toBe('schick dir einen Anmeldelink');
            forgot?.click();
            fixture.detectChanges();

            expect(component.mode()).toBe('link');
            expect(component.form.controls.email.value).toBe('anna@example.com');
            expect(component.passwordError()).toBe('');
            expect(element().querySelector('input[type="password"]')).toBeNull();
            expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent?.trim()).toBe('Anmeldelink schicken');
        });

        it('shows the link form again when a token turns out invalid', async () => {
            redeemToken.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'invalid-token' } })));
            await setup({ token: 'expired' });

            expect(component.mode()).toBe('link');
            expect(modeButtons()).toHaveLength(2);
        });
    });
});
