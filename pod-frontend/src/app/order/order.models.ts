/**
 * Orders API models (`/api/orders`). Request and response shapes are aliases of the generated
 * contract in `src/app/api/openapi.d.ts`; the error shapes below are hand-written: they are
 * problem details, which the OpenAPI document does not describe.
 */
import type { components } from '../api/openapi';
import { QuoteResponse } from '../quote/quote.models';

type Schemas = components['schemas'];

export type OrderStatus = Schemas['OrderResponse']['status'];
export type OrderSettings = Schemas['OrderSettingsResponse'];
/** The order as the backend expects it; each item references the id `POST /api/models` returned. */
export type OrderRequest = Schemas['OrderRequest'];
export type OrderTotals = Schemas['OrderTotals'];
/** The order as `POST /api/orders` and `GET /api/orders/{orderNumber}?email=` return it. */
export type OrderResponse = Schemas['OrderResponse'];

/** Used until `/api/orders/settings` has answered, and if it never does. */
export const FALLBACK_ORDER_SETTINGS: OrderSettings = {
    currency: 'CHF',
    shippingFlatChf: 9,
    vatEnabled: false,
    vatRate: 0.081,
    quoteValidityDays: 14,
    shipToCountries: ['CH']
};

/** Remembered in sessionStorage between checkout, payment page and success page. */
export interface LastOrderReference {
    orderNumber: string;
    email: string;
}

export const LAST_ORDER_STORAGE_KEY = 'pod.lastOrder';

/**
 * 409 from the backend: the quotes were recomputed and the total differs from what the
 * customer saw. The fresh quotes come in the order of the request's items.
 */
export interface PriceChanged {
    kind: 'price-changed';
    currentQuotes: QuoteResponse[];
    totals: OrderTotals;
}

/** 404 from the backend: it no longer keeps the model of the given item; upload it again. */
export interface ModelExpired {
    kind: 'model-expired';
    /** Index into the request's items, when the backend names one. */
    itemIndex: number | null;
}

/** 400 from the backend: validation messages keyed by field (`customer.email`, `items[0].quantity`, `items`). */
export interface FieldErrors {
    kind: 'field-errors';
    errors: Record<string, string>;
}

export interface OtherOrderError {
    kind: 'error';
    message: string;
}

export type OrderFailure = PriceChanged | ModelExpired | FieldErrors | OtherOrderError;
