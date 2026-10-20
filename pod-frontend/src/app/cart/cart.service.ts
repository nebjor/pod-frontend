import { Injectable, signal } from '@angular/core';
import { ColorOption, QuoteResponse } from '../quote/quote.models';

/** One configured model with its quote, handed from the upload page to the checkout. */
export interface CartItem {
    file: File;
    filament: string;
    color: ColorOption;
    quality: string;
    quantity: number;
    quote: QuoteResponse;
}

/**
 * Holds the item being ordered for the lifetime of the page. It lives in memory on purpose:
 * the model file cannot be persisted in the browser, and an order is one model in v1.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
    private readonly current = signal<CartItem | null>(null);

    readonly item = this.current.asReadonly();

    set(item: CartItem) {
        this.current.set(item);
    }

    /** Replaces the quote after the backend reported a changed price. */
    updateQuote(quote: QuoteResponse) {
        this.current.update((item) => (item ? { ...item, quote } : item));
    }

    clear() {
        this.current.set(null);
    }
}
