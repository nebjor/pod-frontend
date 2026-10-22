import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, tap, throwError } from 'rxjs';
import { OrderResponse } from '../order/order.models';
import {
    AccountAddressRequest,
    AccountFailure,
    AccountResponse,
    AccountState,
    LOGIN_RETURN_TO_STORAGE_KEY,
    PasswordLoginRequest,
    SetPasswordRequest
} from './account.models';

export const ACCOUNT_API_URL = '/api/account';

/**
 * The customer's session. The backend keeps it in an HttpOnly cookie, so the browser cannot
 * tell whether one exists until `GET /api/account` has answered; that happens once, after the
 * first render in the browser. The server never asks, so prerendered pages render as `unknown`.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
    private readonly http = inject(HttpClient);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly current = signal<AccountResponse | null>(null);
    private readonly loadState = signal<AccountState>('unknown');
    private loading?: Promise<void>;

    readonly account = this.current.asReadonly();
    readonly state = this.loadState.asReadonly();
    readonly isSignedIn = computed(() => this.loadState() === 'signedIn');
    private readonly wasDeleted = signal(false);
    /** True once this visit removed the account; the account area then shows the farewell card. */
    readonly deleted = this.wasDeleted.asReadonly();

    constructor() {
        if (this.isBrowser) {
            afterNextRender(() => void this.load());
        }
    }

    /**
     * Reads the session once; later calls return the same promise. A 401 means there is no
     * session, which is the normal case for a visitor and never an error.
     */
    load(): Promise<void> {
        if (!this.isBrowser) {
            return Promise.resolve();
        }
        if (!this.loading) {
            this.loadState.set('loading');
            this.loading = firstValueFrom(this.http.get<AccountResponse>(ACCOUNT_API_URL))
                .then((account) => this.signedIn(account))
                .catch(() => this.anonymous());
        }
        return this.loading;
    }

    /** The backend answers 202 whether or not the address has an account, and mails the link. */
    requestLoginLink(email: string): Observable<void> {
        return this.http.post<void>(`${ACCOUNT_API_URL}/login-links`, { email });
    }

    /** Turns the token from the login mail into a session; the cookie comes with the response. */
    redeemToken(token: string): Observable<AccountResponse> {
        return this.http
            .post<AccountResponse>(`${ACCOUNT_API_URL}/sessions`, { token })
            .pipe(tap((account) => this.signedIn(account)));
    }

    /** The optional second way in; anything wrong answers 401 `invalid-credentials`. */
    loginWithPassword(email: string, password: string): Observable<AccountResponse> {
        const body: PasswordLoginRequest = { email, password };
        return this.http
            .post<AccountResponse>(`${ACCOUNT_API_URL}/sessions/password`, body)
            .pipe(tap((account) => this.signedIn(account)));
    }

    /** Sets or replaces the password; the mail link keeps working either way. */
    setPassword(password: string): Observable<void> {
        const body: SetPasswordRequest = { password };
        return this.http.put<void>(`${ACCOUNT_API_URL}/password`, body).pipe(
            this.forgetOnUnauthorized(),
            tap(() => this.patchAccount({ hasPassword: true }))
        );
    }

    /** Back to the mail link only. */
    removePassword(): Observable<void> {
        return this.http.delete<void>(`${ACCOUNT_API_URL}/password`).pipe(
            this.forgetOnUnauthorized(),
            tap(() => this.patchAccount({ hasPassword: false }))
        );
    }

    update(address: AccountAddressRequest): Observable<AccountResponse> {
        return this.http.put<AccountResponse>(ACCOUNT_API_URL, address).pipe(
            this.forgetOnUnauthorized(),
            tap((account) => this.signedIn(account))
        );
    }

    orders(): Observable<OrderResponse[]> {
        return this.http.get<OrderResponse[]>(`${ACCOUNT_API_URL}/orders`).pipe(this.forgetOnUnauthorized());
    }

    logout(): Observable<void> {
        return this.http.delete<void>(`${ACCOUNT_API_URL}/sessions`).pipe(tap(() => this.anonymous()));
    }

    /** Removes the account; the orders stay with the backend. */
    deleteAccount(): Observable<void> {
        return this.http.delete<void>(ACCOUNT_API_URL).pipe(
            tap(() => {
                this.wasDeleted.set(true);
                this.anonymous();
            })
        );
    }

    private signedIn(account: AccountResponse) {
        this.current.set(account);
        this.loadState.set('signedIn');
    }

    /** For answers without a body (204): keeps the local account in step with the backend. */
    private patchAccount(changes: Partial<AccountResponse>) {
        this.current.update((account) => (account ? { ...account, ...changes } : account));
    }

    private anonymous() {
        this.current.set(null);
        this.loadState.set('anonymous');
    }

    /** The session can expire between two calls; the pages then treat the customer as anonymous. */
    private forgetOnUnauthorized<T>() {
        return catchError<T, Observable<never>>((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
                this.anonymous();
            }
            return throwError(() => error);
        });
    }
}

/** Classifies an account failure so the pages can react to each kind. */
export function describeAccountError(error: unknown): AccountFailure {
    if (error instanceof HttpErrorResponse) {
        const problem = (error.error ?? null) as { code?: unknown; errors?: unknown; detail?: unknown } | null;

        if (error.status === 0) {
            return {
                kind: 'error',
                message: 'Der Shop ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es noch einmal.'
            };
        }
        if (error.status === 400 && problem?.code === 'invalid-token') {
            return { kind: 'invalid-token' };
        }
        if (error.status === 400 && problem?.errors && typeof problem.errors === 'object') {
            return { kind: 'field-errors', errors: problem.errors as Record<string, string> };
        }
        if (error.status === 401 && problem?.code === 'invalid-credentials') {
            return { kind: 'invalid-credentials' };
        }
        if (error.status === 401) {
            return { kind: 'error', message: 'Du bist nicht mehr angemeldet. Bitte melde dich neu an.' };
        }
        if (error.status === 429) {
            return { kind: 'error', message: 'Zu viele Versuche. Bitte warte einen Moment und probier es noch einmal.' };
        }
        // The backend words its problem details for the customer; a bare status gets a generic line.
        if (typeof problem?.detail === 'string' && problem.detail.length > 0) {
            return { kind: 'error', message: problem.detail };
        }
    }
    return { kind: 'error', message: 'Das hat gerade nicht geklappt. Bitte versuche es noch einmal.' };
}

/**
 * Only paths of this app are accepted as a place to return to after the login, never another
 * origin (`//evil.example`, `https://...`) and nothing with a scheme.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
        return null;
    }
    return value;
}

/**
 * The login mail carries only the token, so a page that wants the customer back (the checkout)
 * leaves the path here when the link is requested; the login page picks it up after the redeem.
 */
export function rememberLoginReturnPath(path: string | null) {
    try {
        if (path) {
            localStorage.setItem(LOGIN_RETURN_TO_STORAGE_KEY, path);
        } else {
            localStorage.removeItem(LOGIN_RETURN_TO_STORAGE_KEY);
        }
    } catch {
        // Storage can be unavailable (private mode); the customer then lands on the account page.
    }
}

export function takeLoginReturnPath(): string | null {
    try {
        const path = safeReturnPath(localStorage.getItem(LOGIN_RETURN_TO_STORAGE_KEY));
        localStorage.removeItem(LOGIN_RETURN_TO_STORAGE_KEY);
        return path;
    } catch {
        return null;
    }
}
