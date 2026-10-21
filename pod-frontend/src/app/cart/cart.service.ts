import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { Observable, catchError, filter, map, switchMap, tap, throwError } from 'rxjs';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent, isModelExpired } from '../quote/quote.service';
import { CartStorage, StoredCartItem } from './cart-storage';

/** One configured model with its quote. The file stays so the model can be uploaded again. */
export interface CartItem extends StoredCartItem {
    file: File;
}

/** What the upload page hands over; the cart assigns the id. */
export type NewCartItem = Omit<CartItem, 'id'>;

/** The backend accepts this many lines per order. */
export const CART_MAX_ITEMS = 10;

function roundCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function newItemId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The shopping cart: the models the customer configured, each with the quote the backend gave
 * for it. It is restored from {@link CartStorage} once the page has rendered in the browser and
 * written back after every change, so a reload keeps the cart. On the server it is empty.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
    private readonly storage = inject(CartStorage);
    private readonly quoteService = inject(QuoteService);
    private readonly state = signal<CartItem[]>([]);
    private readonly restored = signal(false);
    private resolveReady: () => void = () => undefined;
    private readonly readyPromise = new Promise<void>((resolve) => {
        this.resolveReady = resolve;
    });

    readonly items = this.state.asReadonly();
    /** False until the persisted cart has been read; pages show a loading state meanwhile. */
    readonly ready = this.restored.asReadonly();
    /** Number of pieces across all lines, for the header badge. */
    readonly count = computed(() => this.state().reduce((sum, item) => sum + item.quantity, 0));
    /** Sum of the line totals; the setup fee is part of each quote's total already. */
    readonly itemsTotal = computed(() => roundCents(this.state().reduce((sum, item) => sum + item.quote.totalPriceChf, 0)));
    readonly isEmpty = computed(() => this.state().length === 0);
    readonly isFull = computed(() => this.state().length >= CART_MAX_ITEMS);
    /** All quotes share the shop's currency; taken from the first line. */
    readonly currency = computed(() => this.state()[0]?.quote.currency ?? 'CHF');

    constructor() {
        if (isPlatformBrowser(inject(PLATFORM_ID))) {
            // After the first render so that hydration compares the prerendered, empty cart.
            afterNextRender(() => void this.restore());
        } else {
            this.restored.set(true);
            this.resolveReady();
        }
    }

    /** Resolves once the persisted cart has been read (immediately on the server). */
    whenReady(): Promise<void> {
        return this.readyPromise;
    }

    find(id: string): CartItem | undefined {
        return this.state().find((item) => item.id === id);
    }

    /** Appends a line; returns null when the order limit is reached. */
    add(input: NewCartItem): CartItem | null {
        if (this.isFull()) {
            return null;
        }
        const item: CartItem = { ...input, id: newItemId() };
        void this.storage.putFile(item.id, item.file);
        this.commit([...this.state(), item]);
        return item;
    }

    remove(id: string) {
        this.commit(this.state().filter((item) => item.id !== id));
        void this.storage.deleteFile(id);
    }

    clear() {
        this.commit([]);
        void this.storage.clearFiles();
    }

    /**
     * Asks the backend for a new quote with the changed quantity and stores both once it
     * answers. If the backend has dropped the model meanwhile, the file is uploaded again and
     * the quote requested once more.
     */
    updateQuantity(id: string, quantity: number): Observable<QuoteResponse> {
        const item = this.find(id);
        if (!item) {
            return throwError(() => new Error(`Cart item ${id} does not exist`));
        }
        const params = { filament: item.filament, color: item.color.code, quality: item.quality, quantity };

        return this.quoteService.requestQuote(item.modelId, params).pipe(
            catchError((error: unknown) =>
                isModelExpired(error)
                    ? this.reuploadModel(id).pipe(switchMap((modelId) => this.quoteService.requestQuote(modelId, params)))
                    : throwError(() => error)
            ),
            tap((quote) => this.patch(id, { quantity, quote }))
        );
    }

    /** Uploads the line's file again and remembers the id the backend now keeps it under. */
    reuploadModel(id: string): Observable<string> {
        const item = this.find(id);
        if (!item) {
            return throwError(() => new Error(`Cart item ${id} does not exist`));
        }
        return this.quoteService.uploadModel(item.file).pipe(
            filter((event): event is Extract<UploadEvent, { kind: 'done' }> => event.kind === 'done'),
            map((event) => event.model.modelId),
            tap((modelId) => this.patch(id, { modelId }))
        );
    }

    /** Replaces a line's quote after the backend reported a changed price. */
    replaceQuote(id: string, quote: QuoteResponse) {
        this.patch(id, { quote });
    }

    /**
     * Reads the persisted cart back. Lines whose file is gone are dropped: without the file the
     * model could not be uploaded again if the backend has expired it.
     */
    async restore(): Promise<void> {
        const restoredItems: CartItem[] = [];
        for (const entry of this.storage.readItems()) {
            const file = await this.storage.getFile(entry.id);
            if (file) {
                restoredItems.push({ ...entry, file: file.name === entry.fileName ? file : new File([file], entry.fileName, { type: file.type }) });
            }
        }
        // Lines added while the files were loading stay; persisted ones go in front of them.
        const current = this.state();
        const known = new Set(current.map((item) => item.id));
        this.commit([...restoredItems.filter((item) => !known.has(item.id)), ...current]);
        this.restored.set(true);
        this.resolveReady();
        void this.storage.pruneFiles(this.state().map((item) => item.id));
    }

    private patch(id: string, changes: Partial<StoredCartItem>) {
        this.commit(this.state().map((item) => (item.id === id ? { ...item, ...changes } : item)));
    }

    private commit(items: CartItem[]) {
        this.state.set(items);
        this.storage.writeItems(items.map(({ file: _file, ...stored }) => stored));
    }
}
