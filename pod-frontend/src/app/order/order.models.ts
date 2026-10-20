/**
 * Orders API models (`/api/orders`). Response shapes are aliases of the generated contract in
 * `src/app/api/openapi.d.ts`; request parameters and error shapes are hand-written.
 */
import type { components } from '../api/openapi';
import { QuoteResponse } from '../quote/quote.models';

type Schemas = components['schemas'];

export type OrderStatus = Schemas['OrderResponse']['status'];
export type OrderTotals = Schemas['OrderTotals'];
export type OrderResponse = Schemas['OrderResponse'];
export type OrderSettings = Schemas['OrderSettingsResponse'];

export interface CustomerDetails {
    customerName: string;
    email: string;
    street: string;
    postalCode: string;
    city: string;
    /** ISO 3166-1 alpha-2, e.g. CH */
    country: string;
}

export interface OrderRequestParams extends CustomerDetails {
    filament: string;
    color: string;
    quality: string;
    quantity: number;
    /** The total the customer saw; the backend answers 409 if it no longer holds. */
    expectedTotalChf: number;
}

/** Remembered in sessionStorage between checkout, payment page and success page. */
export interface LastOrderReference {
    orderNumber: string;
    email: string;
}

export const LAST_ORDER_STORAGE_KEY = 'pod.lastOrder';

/** 409 from the backend: the quote was recomputed and differs from what the customer saw. */
export interface PriceChanged {
    kind: 'price-changed';
    currentQuote: QuoteResponse;
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

export type OrderFailure = PriceChanged | FieldErrors | OtherOrderError;
