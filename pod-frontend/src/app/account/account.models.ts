/**
 * Customer account API models (`/api/account`). Request and response shapes are aliases of
 * the generated contract in `src/app/api/openapi.d.ts`; the error shapes below are
 * hand-written: they are problem details, which the OpenAPI document does not describe.
 */
import type { components } from '../api/openapi';

type Schemas = components['schemas'];

/**
 * The account as `GET /api/account`, `POST /api/account/sessions`, `POST /api/account/sessions/password`
 * and `PUT /api/account` return it.
 */
export type AccountResponse = Schemas['AccountResponse'] & AccountPasswordFields;
/** Body of `PUT /api/account`. */
export type AccountAddressRequest = Schemas['AccountUpdateRequest'];

// --- Hand-written until the OpenAPI document is regenerated with the password endpoints. ---

/**
 * `hasPassword` says whether the customer set a password next to the mail link. The backend
 * always sends it; optional here only until the generated contract carries the field.
 */
export interface AccountPasswordFields {
    hasPassword?: boolean;
}

/** Body of `POST /api/account/sessions/password`; a 401 `invalid-credentials` answers anything wrong. */
export interface PasswordLoginRequest {
    email: string;
    password: string;
}

/** Body of `PUT /api/account/password`; the length rule mirrors the backend's validation. */
export interface SetPasswordRequest {
    password: string;
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

// --- End of the hand-written block. ---

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

/** 401 with `code: invalid-credentials`: e-mail or password wrong; the backend does not say which. */
export interface InvalidCredentials {
    kind: 'invalid-credentials';
}

export interface OtherAccountError {
    kind: 'error';
    message: string;
}

export type AccountFailure = AccountFieldErrors | InvalidLoginToken | InvalidCredentials | OtherAccountError;

/** The account pages send a visitor without a session here (see app.routes.ts). */
export const LOGIN_PATH = '/konto/anmelden';
/** Where a password is set, changed or removed; the login mail links here with `?next=`. */
export const PASSWORD_PATH = '/konto/passwort';

/** Where the login page sends the customer after a successful login; set when a page asked for it. */
export const LOGIN_RETURN_TO_STORAGE_KEY = 'pod.loginReturnTo';
