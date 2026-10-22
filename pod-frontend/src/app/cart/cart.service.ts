import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, filter, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent, isModelExpired } from '../quote/quote.service';
import { AccountCartApi } from './account-cart.api';
import { CartStorage, StoredCartItem } from './cart-storage';

/**
 * One configured model with its quote. The file stays so the model can be uploaded again. Lines
 * that came from the account cart of another device have no file; the server keeps it and
 * registers it again on demand (`serverId`). Their `modelId` is empty until that happened.
 */
export interface CartItem extends StoredCartItem {
    file?: File;
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
 * written back after every change, so a reload keeps the cart. Other tabs of the shop share the
 * storage; their changes are taken over as they happen. On the server it is empty.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
    private readonly storage = inject(CartStorage);
    private readonly quoteService = inject(QuoteService);
    private readonly accountCart = inject(AccountCartApi);
    private readonly state = signal<CartItem[]>([]);
    private readonly restored = signal(false);
    /** Serialises restore and cross-tab sync so two reads never interleave their writes. */
    private pending: Promise<void> = Promise.resolve();
    private resolveReady: () => void = () => undefined;
    private readonly readyPromise = new Promise<void>((resolve) => {
        this.resolveReady = resolve;
    });

    /** Emits after every change the customer made on this device; not for restores or foreign tabs. */
    readonly changes = new Subject<void>();
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
            afterNextRender(() => {
                void this.restore();
                this.storage.onChange(() => void this.sync());
            });
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
        if (item.file) {
            void this.storage.putFile(item.id, item.file);
        }
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

        const quote = (modelId: string) => this.quoteService.requestQuote(modelId, params);
        // Lines from the account cart have no upload id until the server registered their file.
        const first = item.modelId ? quote(item.modelId) : this.refreshModel(id).pipe(switchMap(quote));

        return first.pipe(
            catchError((error: unknown) =>
                isModelExpired(error) ? this.refreshModel(id).pipe(switchMap(quote)) : throwError(() => error)
            ),
            tap((result) => this.patch(id, { quantity, quote: result }))
        );
    }

    /**
     * Gives the line a fresh upload id: from the local file when there is one, otherwise from the
     * server's stored copy of an account cart line. Emits the new id.
     */
    refreshModel(id: string): Observable<string> {
        const item = this.find(id);
        if (!item) {
            return throwError(() => new Error(`Cart item ${id} does not exist`));
        }
        let modelId$: Observable<string>;
        if (item.file) {
            modelId$ = this.quoteService.uploadModel(item.file).pipe(
                filter((event): event is Extract<UploadEvent, { kind: 'done' }> => event.kind === 'done'),
                map((event) => event.model.modelId)
            );
        } else if (item.serverId) {
            modelId$ = this.accountCart.registerModel(item.serverId).pipe(map((model) => model.modelId));
        } else {
            return throwError(() => new Error(`Cart item ${id} has neither a file nor a server copy`));
        }
        // The upload id is not part of the cart the customer edited; no push needed.
        return modelId$.pipe(tap((modelId) => this.patch(id, { modelId }, false)));
    }

    /** Makes sure every line can be quoted and ordered, i.e. has an upload id. */
    ensureModelIds(): Observable<void> {
        const missing = this.state().filter((item) => !item.modelId);
        return missing.length === 0
            ? of(undefined)
            : forkJoin(missing.map((item) => this.refreshModel(item.id))).pipe(map(() => undefined));
    }

    /** Replaces a line's quote after the backend reported a changed price. */
    replaceQuote(id: string, quote: QuoteResponse) {
        this.patch(id, { quote });
    }

    /**
     * Reads the persisted cart back. Lines whose file is gone are dropped: without the file the
     * model could not be uploaded again if the backend has expired it. Lines of the account cart
     * stay: the server keeps their file.
     */
    restore(): Promise<void> {
        // Read synchronously: a line added in the same tick would overwrite the stored cart
        // before the queued work ran.
        const entries = this.storage.readItems();
        return this.queue(async () => {
            const restoredItems = await this.loadFiles(entries);
            // Lines added while the files were loading stay; persisted ones go in front of them.
            const current = this.state();
            const known = new Set(current.map((item) => item.id));
            this.commit([...restoredItems.filter((item) => !known.has(item.id)), ...current], false);
            this.restored.set(true);
            this.resolveReady();
            void this.storage.pruneFiles(this.state().map((item) => item.id));
        });
    }

    /**
     * Takes over what another tab wrote: its line order and quotes win, files already in memory
     * are reused, new ones are read from storage. Nothing is written back, so the tabs never
     * ping-pong their copies.
     */
    sync(): Promise<void> {
        const entries = this.storage.readItems();
        return this.queue(async () => {
            this.state.set(await this.loadFiles(entries));
        });
    }

    private async loadFiles(entries: StoredCartItem[]): Promise<CartItem[]> {
        const inMemory = new Map(this.state().map((item) => [item.id, item.file]));
        const items: CartItem[] = [];
        for (const entry of entries) {
            const file = inMemory.get(entry.id) ?? (await this.storage.getFile(entry.id));
            if (file) {
                items.push({ ...entry, file: file.name === entry.fileName ? file : new File([file], entry.fileName, { type: file.type }) });
            } else if (entry.serverId) {
                items.push(entry);
            }
        }
        return items;
    }

    private queue(work: () => Promise<void>): Promise<void> {
        this.pending = this.pending.then(work, work);
        return this.pending;
    }

    /**
     * Sets the server ids the account cart assigned. Not a customer change, so nothing is
     * pushed back.
     */
    attachServerIds(serverIds: ReadonlyMap<string, string>) {
        this.commit(
            this.state().map((item) => (serverIds.has(item.id) ? { ...item, serverId: serverIds.get(item.id) } : item)),
            false
        );
    }

    /** Takes the merged cart after signing in. Nothing is pushed by this call. */
    replaceAll(items: CartItem[]) {
        const keep = new Set(items.map((item) => item.id));
        for (const old of this.state()) {
            if (!keep.has(old.id)) {
                void this.storage.deleteFile(old.id);
            }
        }
        this.commit(items, false);
    }

    /**
     * After signing out the device keeps the lines it has the file for; lines that only existed
     * in the account cart go.
     */
    detachFromAccount() {
        const kept = this.state()
            .filter((item) => item.file)
            .map(({ serverId: _serverId, ...item }) => item);
        this.commit(kept, false);
        void this.storage.pruneFiles(kept.map((item) => item.id));
    }

    private patch(id: string, changes: Partial<StoredCartItem>, notify = true) {
        this.commit(
            this.state().map((item) => (item.id === id ? { ...item, ...changes } : item)),
            notify
        );
    }

    private commit(items: CartItem[], notify = true) {
        this.state.set(items);
        this.storage.writeItems(items.map(({ file: _file, ...stored }) => stored));
        if (notify) {
            this.changes.next();
        }
    }
}
