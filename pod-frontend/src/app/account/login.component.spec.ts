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
                        requestLoginLink
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
});
