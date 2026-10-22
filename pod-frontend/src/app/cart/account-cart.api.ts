import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../api/openapi';
import { UploadedModel } from '../quote/quote.models';

type Schemas = components['schemas'];

export type AccountCartResponse = Schemas['CartResponse'];
export type AccountCartLine = Schemas['CartItemResponse'];
export type AccountCartRequest = Schemas['CartRequest'];
export type AccountCartLineRequest = Schemas['CartItemRequest'];

export const ACCOUNT_CART_URL = '/api/account/cart';

/** The signed-in customer's cart on the server; every call needs the session cookie. */
@Injectable({ providedIn: 'root' })
export class AccountCartApi {
    private readonly http = inject(HttpClient);

    load(): Observable<AccountCartResponse> {
        return this.http.get<AccountCartResponse>(ACCOUNT_CART_URL);
    }

    /** Replaces the whole cart in the given order. */
    replace(items: AccountCartLineRequest[]): Observable<AccountCartResponse> {
        const body: AccountCartRequest = { items };
        return this.http.put<AccountCartResponse>(ACCOUNT_CART_URL, body);
    }

    clear(): Observable<void> {
        return this.http.delete<void>(ACCOUNT_CART_URL);
    }

    /** Registers the stored file of a line under a fresh upload id, for quoting and ordering. */
    registerModel(lineId: string): Observable<UploadedModel> {
        return this.http.post<UploadedModel>(`${ACCOUNT_CART_URL}/${encodeURIComponent(lineId)}/model`, null);
    }
}

/** Error code of a problem-details answer (`model-expired`, `cart-item-not-found`, ...). */
export function cartProblemCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
        return null;
    }
    const code = ((error.error ?? null) as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : null;
}

/** Index of the line the backend refused with `model-expired`. */
export function cartProblemItemIndex(error: unknown): number | null {
    if (!(error instanceof HttpErrorResponse)) {
        return null;
    }
    const index = ((error.error ?? null) as { itemIndex?: unknown } | null)?.itemIndex;
    return typeof index === 'number' ? index : null;
}
