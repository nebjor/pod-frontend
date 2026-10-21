/**
 * Customer account API models (`/api/account`). Request and response shapes are aliases of
 * the generated contract in `src/app/api/openapi.d.ts`; the error shapes below are
 * hand-written: they are problem details, which the OpenAPI document does not describe.
 */
import type { components } from '../api/openapi';

type Schemas = components['schemas'];

/** The account as `GET /api/account`, `POST /api/account/sessions` and `PUT /api/account` return it. */
export type AccountResponse = Schemas['AccountResponse'];
/** Body of `PUT /api/account`. */
export type AccountAddressRequest = Schemas['AccountUpdateRequest'];

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
