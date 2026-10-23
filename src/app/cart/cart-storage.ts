import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { ColorOption, QuoteResponse } from '../quote/quote.models';

/** What localStorage keeps per cart line: everything but the file, which lives in IndexedDB. */
export interface StoredCartItem {
    id: string;
    /** Id of the line in the account cart on the server; set while signed in. */
    serverId?: string;
    fileName: string;
    sizeBytes: number;
    modelId: string;
    filament: string;
    color: ColorOption;
    quality: string;
    quantity: number;
    quote: QuoteResponse;
}

export const CART_STORAGE_KEY = 'pod.cart';
const CART_STORAGE_VERSION = 1;
const DB_NAME = 'pod-cart';
const DB_VERSION = 1;
const FILE_STORE = 'files';

interface StoredCart {
    version: number;
    items: StoredCartItem[];
}

/**
 * Persists the cart across reloads, tabs and browser restarts. The line metadata and quotes are
 * small and go to localStorage; the model files are blobs and go to IndexedDB, keyed by the line
 * id. Both are shared by every tab of the origin, which matters because the login link in the
 * registration mail opens a new tab: with tab-scoped storage that tab would see an empty cart and
 * prune the files the first tab still relies on. Everything is browser-only and best effort: on
 * the server, in private windows or when a browser blocks storage, every call degrades to
 * "nothing stored" and the cart simply lives in memory.
 */
@Injectable({ providedIn: 'root' })
export class CartStorage {
    private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
    private db?: Promise<IDBDatabase | null>;

    readItems(): StoredCartItem[] {
        if (!this.browser) {
            return [];
        }
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as Partial<StoredCart>) : null;
            if (parsed?.version !== CART_STORAGE_VERSION || !Array.isArray(parsed.items)) {
                return [];
            }
            return parsed.items.filter((item) => typeof item?.id === 'string' && typeof item.modelId === 'string');
        } catch {
            return [];
        }
    }

    writeItems(items: StoredCartItem[]): void {
        if (!this.browser) {
            return;
        }
        try {
            if (items.length === 0) {
                localStorage.removeItem(CART_STORAGE_KEY);
            } else {
                const stored: StoredCart = { version: CART_STORAGE_VERSION, items };
                localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stored));
            }
        } catch {
            // Quota or private mode: the cart still works for this page view.
        }
    }

    /**
     * Calls the listener whenever another tab writes the cart. The browser fires `storage` only in
     * the tabs that did not make the change, so a tab never hears its own writes. Returns the
     * unsubscribe function.
     */
    onChange(listener: () => void): () => void {
        if (!this.browser || typeof window === 'undefined') {
            return () => undefined;
        }
        const handler = (event: StorageEvent) => {
            // A null key means the whole storage was cleared.
            if (event.key === null || event.key === CART_STORAGE_KEY) {
                listener();
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }

    async putFile(id: string, file: File): Promise<void> {
        await this.run('readwrite', (store) => store.put(file, id));
    }

    async getFile(id: string): Promise<File | null> {
        const stored = await this.run<unknown>('readonly', (store) => store.get(id));
        if (stored instanceof File) {
            return stored;
        }
        // Some browsers hand a plain Blob back; the name is restored from the metadata by the caller.
        return stored instanceof Blob ? new File([stored], id) : null;
    }

    async deleteFile(id: string): Promise<void> {
        await this.run('readwrite', (store) => store.delete(id));
    }

    /** Drops the blobs of lines that no longer exist, e.g. after a reload lost their metadata. */
    async pruneFiles(keepIds: ReadonlyArray<string>): Promise<void> {
        const keys = (await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())) ?? [];
        const keep = new Set<IDBValidKey>(keepIds);
        for (const key of keys) {
            if (!keep.has(key)) {
                await this.deleteFile(String(key));
            }
        }
    }

    async clearFiles(): Promise<void> {
        await this.run('readwrite', (store) => store.clear());
    }

    private open(): Promise<IDBDatabase | null> {
        if (!this.browser || typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }
        this.db ??= new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains(FILE_STORE)) {
                        request.result.createObjectStore(FILE_STORE);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
                request.onblocked = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
        return this.db;
    }

    /** Runs one request in its own transaction; any failure resolves to null instead of throwing. */
    private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
        const db = await this.open();
        if (!db) {
            return null;
        }
        return new Promise<T | null>((resolve) => {
            try {
                const transaction = db.transaction(FILE_STORE, mode);
                const request = action(transaction.objectStore(FILE_STORE));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
                transaction.onabort = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }
}
