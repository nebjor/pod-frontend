/** Mirrors the JSON contract of the cad-slicer-engine orders API (`/api/orders`). */

import { FilamentCode, QualityCode, QuoteResponse } from '../quote/quote.models';

export type OrderStatus = 'NEW' | 'PAID' | 'IN_REVIEW' | 'PRINTING' | 'SHIPPED' | 'CANCELLED';

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
    filament: FilamentCode;
    color: string;
    quality: QualityCode;
    quantity: number;
    /** The total the customer saw; the backend answers 409 if it no longer holds. */
    expectedTotalChf: number;
}

export interface OrderTotals {
    setupFee: number;
    unitPrice: number;
    itemsTotal: number;
    shipping: number;
    vatRate: number;
    vatAmount: number;
    total: number;
    currency: string;
}

export interface OrderResponse {
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    quoteExpiresAt: string;
    customerName: string;
    customerEmail: string;
    fileName: string;
    filament: string;
    colorCode: string;
    colorLabel: string;
    quality: string;
    quantity: number;
    plateCount: number;
    totalPrintTimeSeconds: number;
    totalFilamentGrams: number;
    totals: OrderTotals;
    /** Present when no VAT is charged. */
    vatNote: string | null;
}

export interface OrderSettings {
    currency: string;
    shippingFlatChf: number;
    vatEnabled: boolean;
    vatRate: number;
    quoteValidityDays: number;
    shipToCountries: string[];
}

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
