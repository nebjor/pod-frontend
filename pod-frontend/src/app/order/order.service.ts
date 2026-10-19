import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { QuoteResponse } from '../quote/quote.models';
import { describeQuoteError } from '../quote/quote.service';
import { OrderFailure, OrderRequestParams, OrderResponse, OrderSettings } from './order.models';

export const ORDER_API_URL = '/api/orders';

@Injectable({ providedIn: 'root' })
export class OrderService {
    private readonly http = inject(HttpClient);

    /** Sends the model and the checkout form; the backend recomputes the price and stores the order. */
    placeOrder(file: File, params: OrderRequestParams): Observable<OrderResponse> {
        const body = new FormData();
        body.append('file', file, file.name);
        body.append('filament', params.filament);
        body.append('color', params.color);
        body.append('quality', params.quality);
        body.append('quantity', String(params.quantity));
        body.append('expectedTotalChf', params.expectedTotalChf.toFixed(2));
        body.append('customerName', params.customerName);
        body.append('email', params.email);
        body.append('street', params.street);
        body.append('postalCode', params.postalCode);
        body.append('city', params.city);
        body.append('country', params.country);

        return this.http.post<OrderResponse>(ORDER_API_URL, body);
    }

    loadSettings(): Observable<OrderSettings> {
        return this.http.get<OrderSettings>(`${ORDER_API_URL}/settings`);
    }
}

/** Classifies an order failure so the checkout page can react to each kind. */
export function describeOrderError(error: unknown): OrderFailure {
    if (error instanceof HttpErrorResponse) {
        const problem = (error.error ?? null) as { currentQuote?: unknown; errors?: unknown } | null;

        if (error.status === 409 && problem?.currentQuote) {
            return { kind: 'price-changed', currentQuote: problem.currentQuote as QuoteResponse };
        }
        if (error.status === 400 && problem?.errors && typeof problem.errors === 'object') {
            return { kind: 'field-errors', errors: problem.errors as Record<string, string> };
        }
    }

    return { kind: 'error', message: describeQuoteError(error) };
}
