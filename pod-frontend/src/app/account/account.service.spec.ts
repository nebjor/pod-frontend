import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountResponse, LOGIN_RETURN_TO_STORAGE_KEY } from './account.models';
import {
    ACCOUNT_API_URL,
    AccountService,
    describeAccountError,
    rememberLoginReturnPath,
    safeReturnPath,
    takeLoginReturnPath
} from './account.service';

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

describe('AccountService', () => {
    let service: AccountService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        service = TestBed.inject(AccountService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        http.verify();
        localStorage.clear();
    });

    it('starts without knowing whether there is a session', () => {
        expect(service.state()).toBe('unknown');
        expect(service.account()).toBeNull();
    });

    it('asks for a login link and is content with the 202', () => {
        const done = vi.fn();
        service.requestLoginLink('anna@example.com').subscribe({ complete: done });

        const request = http.expectOne(`${ACCOUNT_API_URL}/login-links`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ email: 'anna@example.com' });
        request.flush(null, { status: 202, statusText: 'Accepted' });

        expect(done).toHaveBeenCalled();
    });

    it('treats a 401 on load as an anonymous visitor, not as an error', async () => {
        const loading = service.load();
        expect(service.state()).toBe('loading');

        const request = http.expectOne(ACCOUNT_API_URL);
        expect(request.request.method).toBe('GET');
        request.flush({ code: 'not-logged-in' }, { status: 401, statusText: 'Unauthorized' });
        await loading;

        expect(service.state()).toBe('anonymous');
        expect(service.account()).toBeNull();
    });

    it('loads the session once and keeps the account', async () => {
        const loading = service.load();
        http.expectOne(ACCOUNT_API_URL).flush(anna);
        await loading;

        expect(service.state()).toBe('signedIn');
        expect(service.isSignedIn()).toBe(true);
        expect(service.account()).toEqual(anna);

        await service.load();
        http.expectNone(ACCOUNT_API_URL);
    });

    it('redeems a login token and is signed in afterwards', () => {
        const received = vi.fn();
        service.redeemToken('tok-123').subscribe(received);

        const request = http.expectOne(`${ACCOUNT_API_URL}/sessions`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ token: 'tok-123' });
        request.flush(anna);

        expect(received).toHaveBeenCalledWith(anna);
        expect(service.state()).toBe('signedIn');
        expect(service.account()?.email).toBe('anna@example.com');
    });

    it('saves the address and takes over what the backend answers', () => {
        const address = { name: 'Anna Muster', street: 'Seestrasse 2', postalCode: '8002', city: 'Zuerich', country: 'CH' };
        service.update(address).subscribe();

        const request = http.expectOne(ACCOUNT_API_URL);
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual(address);
        request.flush({ ...anna, street: 'Seestrasse 2', postalCode: '8002' });

        expect(service.account()?.street).toBe('Seestrasse 2');
        expect(service.state()).toBe('signedIn');
    });

    it('lists the orders of the account', () => {
        const received = vi.fn();
        service.orders().subscribe(received);

        const request = http.expectOne(`${ACCOUNT_API_URL}/orders`);
        expect(request.request.method).toBe('GET');
        request.flush([{ orderNumber: 'POD-1000' }]);

        expect(received).toHaveBeenCalledWith([{ orderNumber: 'POD-1000' }]);
    });

    it('forgets the account when a call finds the session expired', () => {
        service.redeemToken('tok-123').subscribe();
        http.expectOne(`${ACCOUNT_API_URL}/sessions`).flush(anna);
        const failed = vi.fn();

        service.orders().subscribe({ error: failed });
        http.expectOne(`${ACCOUNT_API_URL}/orders`).flush({ code: 'not-logged-in' }, { status: 401, statusText: 'Unauthorized' });

        expect(failed).toHaveBeenCalled();
        expect(service.state()).toBe('anonymous');
        expect(service.account()).toBeNull();
    });

    it('logs out and is anonymous afterwards', () => {
        service.redeemToken('tok-123').subscribe();
        http.expectOne(`${ACCOUNT_API_URL}/sessions`).flush(anna);

        service.logout().subscribe();
        const request = http.expectOne(`${ACCOUNT_API_URL}/sessions`);
        expect(request.request.method).toBe('DELETE');
        request.flush(null, { status: 204, statusText: 'No Content' });

        expect(service.state()).toBe('anonymous');
        expect(service.account()).toBeNull();
    });

    it('deletes the account and is anonymous afterwards', () => {
        service.redeemToken('tok-123').subscribe();
        http.expectOne(`${ACCOUNT_API_URL}/sessions`).flush(anna);

        service.deleteAccount().subscribe();
        const request = http.expectOne(ACCOUNT_API_URL);
        expect(request.request.method).toBe('DELETE');
        request.flush(null, { status: 204, statusText: 'No Content' });

        expect(service.state()).toBe('anonymous');
    });
});

describe('describeAccountError', () => {
    it('recognises an invalid login token', () => {
        const error = new HttpErrorResponse({ status: 400, error: { code: 'invalid-token' } });
        expect(describeAccountError(error)).toEqual({ kind: 'invalid-token' });
    });

    it('hands field errors on', () => {
        const error = new HttpErrorResponse({ status: 400, error: { errors: { postalCode: 'must not be blank' } } });
        expect(describeAccountError(error)).toEqual({ kind: 'field-errors', errors: { postalCode: 'must not be blank' } });
    });

    it('explains an unreachable backend and uses the problem detail otherwise', () => {
        expect(describeAccountError(new HttpErrorResponse({ status: 0 }))).toMatchObject({ kind: 'error', message: expect.stringContaining('nicht erreichbar') });
        expect(describeAccountError(new HttpErrorResponse({ status: 503, error: { detail: 'Mail service down' } }))).toEqual({ kind: 'error', message: 'Mail service down' });
        expect(describeAccountError(new Error('boom')).kind).toBe('error');
    });
});

describe('login return path', () => {
    afterEach(() => localStorage.clear());

    it('accepts paths of this app only', () => {
        expect(safeReturnPath('/checkout')).toBe('/checkout');
        expect(safeReturnPath('/konto?x=1')).toBe('/konto?x=1');
        expect(safeReturnPath('//evil.example/')).toBeNull();
        expect(safeReturnPath('/\\evil.example')).toBeNull();
        expect(safeReturnPath('https://evil.example/')).toBeNull();
        expect(safeReturnPath('checkout')).toBeNull();
        expect(safeReturnPath('')).toBeNull();
        expect(safeReturnPath(null)).toBeNull();
    });

    it('remembers the path until the login link is opened', () => {
        rememberLoginReturnPath('/checkout');
        expect(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY)).toBe('/checkout');

        expect(takeLoginReturnPath()).toBe('/checkout');
        expect(takeLoginReturnPath()).toBeNull();
    });

    it('clears a stale path and ignores a tampered one', () => {
        rememberLoginReturnPath('/checkout');
        rememberLoginReturnPath(null);
        expect(takeLoginReturnPath()).toBeNull();

        localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, 'https://evil.example/');
        expect(takeLoginReturnPath()).toBeNull();
    });
});
