/**
 * Customer account API models (`/api/account`).
 */

// ---------------------------------------------------------------------------------------------
// Hand-written account contract. The backend is built in parallel and the generated
// `src/app/api/openapi.d.ts` does not carry these schemas yet; once it does, the interfaces in
// this block are to be replaced by aliases of the generated ones (see order.models.ts).
// ---------------------------------------------------------------------------------------------

/** The account as `GET /api/account`, `POST /api/account/sessions` and `PUT /api/account` return it. */
export interface AccountResponse {
    email: string;
    name: string | null;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    /** ISO 3166-1 alpha-2, e.g. CH */
    country: string | null;
    /** Format: date-time */
    createdAt: string;
    /** Format: date-time */
    lastLoginAt: string;
}

/** Body of `PUT /api/account`. */
export interface AccountAddressRequest {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
}

// ---------------------------------------------------------------------------------------------

/**
 * Whether the browser holds a customer session. `unknown` until the first answer of
 * `GET /api/account` (and for the whole of a server render), so pages can avoid flicker.
 */
export type AccountState = 'unknown' | 'loading' | 'anonymous' | 'signedIn';

/** 400 from the backend: per-field validation messages. */
export interface AccountFieldErrors {
    kind: 'field-errors';
    errors: Record<string, string>;
}

/** 400 with `code: invalid-token`: the login link was used already, expired or never existed. */
export interface InvalidLoginToken {
    kind: 'invalid-token';
}

export interface OtherAccountError {
    kind: 'error';
    message: string;
}

export type AccountFailure = AccountFieldErrors | InvalidLoginToken | OtherAccountError;

/** Where the login page sends the customer after a successful login; set when a page asked for it. */
export const LOGIN_RETURN_TO_STORAGE_KEY = 'pod.loginReturnTo';
