/**
 * Orders API models (`/api/orders`). Settings and the status enum are aliases of the generated
 * contract in `src/app/api/openapi.d.ts`; request parameters and error shapes are hand-written.
 */
import type { components } from '../api/openapi';
import { ColorOption, QuoteResponse } from '../quote/quote.models';

type Schemas = components['schemas'];

export type OrderStatus = Schemas['OrderResponse']['status'];
export type OrderSettings = Schemas['OrderSettingsResponse'];

/** Used until `/api/orders/settings` has answered, and if it never does. */
export const FALLBACK_ORDER_SETTINGS: OrderSettings = {
    currency: 'CHF',
    shippingFlatChf: 9,
    vatEnabled: false,
    vatRate: 0.081,
    quoteValidityDays: 14,
    shipToCountries: ['CH']
};

// ---------------------------------------------------------------------------------------------
// Multi-item order contract. These interfaces mirror the backend contract for the cart release
// (JSON `POST /api/orders` with an `items` list, `items` and order-level `totals` on the
// response). The generated `openapi.d.ts` does not carry them yet; once the backend publishes
// the contract they are to be replaced by aliases of the generated schemas, like the types above.
// ---------------------------------------------------------------------------------------------

export interface OrderCustomer {
    name: string;
    email: string;
    street: string;
    postalCode: string;
    city: string;
    /** ISO 3166-1 alpha-2, e.g. CH */
    country: string;
}

/** One cart line as the backend expects it; the model is referenced by the id `POST /api/models` returned. */
export interface OrderItemRequest {
    modelId: string;
    fileName: string;
    filament: string;
    color: string;
    quality: string;
    quantity: number;
}

export interface OrderRequest {
    customer: OrderCustomer;
    items: OrderItemRequest[];
    /** The items total the customer saw; the backend answers 409 if it no longer holds. */
    expectedTotalChf: number;
}

export interface OrderItemResponse {
    /** 1-based position in the order. */
    position: number;
    fileName: string;
    filament: string;
    color: ColorOption;
    quality: string;
    quantity: number;
    unitPriceChf: number;
    setupFeeChf: number;
    lineTotalChf: number;
    printTimeSeconds: number;
    filamentGrams: number;
}

export interface OrderTotals {
    itemsTotal: number;
    shipping: number;
    vatRate: number;
    vatAmount: number;
    total: number;
    currency: string;
}

/** The order as `POST /api/orders` and `GET /api/orders/{orderNumber}?email=` return it. */
export interface OrderResponse {
    orderNumber: string;
    status: OrderStatus;
    /** Format: date-time */
    createdAt: string;
    /** Format: date-time */
    quoteExpiresAt: string;
    /** Format: date-time */
    paidAt: string | null;
    paymentUrl: string | null;
    customerName: string;
    customerEmail: string;
    items: OrderItemResponse[];
    totals: OrderTotals;
    vatNote: string | null;
}

// ---------------------------------------------------------------------------------------------

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

/** 400 from the backend: per-field validation messages. */
export interface FieldErrors {
    kind: 'field-errors';
    errors: Record<string, string>;
}

export interface OtherOrderError {
    kind: 'error';
    message: string;
}

export type OrderFailure = PriceChanged | ModelExpired | FieldErrors | OtherOrderError;
