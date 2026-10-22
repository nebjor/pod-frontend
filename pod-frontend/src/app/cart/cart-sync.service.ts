import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountService } from '../account/account.service';
import { ColorOption, QuoteResponse } from '../quote/quote.models';
import {
    AccountCartApi,
    AccountCartLine,
    AccountCartLineRequest,
    cartProblemCode,
    cartProblemItemIndex
} from './account-cart.api';
import { CART_MAX_ITEMS, CartItem, CartService } from './cart.service';

/** A change is pushed this long after the last one, so a burst of edits is one request. */
export const CART_SYNC_DEBOUNCE_MS = 500;

/** How often one push may repair its own request (expired uploads, stale line ids) before it gives up. */
const MAX_REPAIRS = 3;

/** Tells the customer that the merged cart did not fit; shown on the cart page. */
export interface CartSyncNotice {
    /** Lines of this device that were left out because the cart is full. */
    dropped: number;
}

/**
 * Keeps the cart of a signed-in customer on the server, so it follows the customer across
 * devices. The browser cart stays the working copy: every change is written to the account
 * cart a moment later (the whole list, last write wins), and signing in merges what the server
 * has with what this device collected before. Failures are logged and retried with the next
 * change; the cart never waits for the network.
 */
@Injectable({ providedIn: 'root' })
export class CartSyncService {
    private readonly cart = inject(CartService);
    private readonly account = inject(AccountService);
    private readonly api = inject(AccountCartApi);
    private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly noticeState = signal<CartSyncNotice | null>(null);

    /** Set after a merge that had to leave lines out. */
    readonly notice = this.noticeState.asReadonly();

    private initial?: Promise<void>;
    private syncing = false;
    private dirty = false;
    private signedInSeen = false;
    private timer?: ReturnType<typeof setTimeout>;
    /** Serialises pushes so two requests never overtake each other. */
    private pushing: Promise<void> = Promise.resolve();

    constructor() {
        if (!this.browser) {
            return;
        }
        effect(() => {
            const signedIn = this.account.isSignedIn();
            untracked(() => (signedIn ? void this.ensureSynced() : this.signedOut()));
        });
        this.cart.changes.subscribe(() => this.localChange());
    }

    /**
     * Resolves once the first merge after signing in is done, so that a page which decides by
     * the cart (the redirect after the login) sees the customer's cart. Resolves at once for a
     * visitor who is not signed in, and also when the server could not be reached.
     */
    ensureSynced(): Promise<void> {
        if (!this.browser || !this.account.isSignedIn()) {
            return Promise.resolve();
        }
        this.signedInSeen = true;
        this.initial ??= this.initialSync();
        return this.initial;
    }

    dismissNotice() {
        this.noticeState.set(null);
    }

    private async initialSync() {
        this.syncing = true;
        try {
            await this.cart.whenReady();
            const server = await firstValueFrom(this.api.load());
            this.cart.replaceAll(this.merge(server.items));
            await this.flush();
        } catch (error) {
            console.warn('The account cart could not be loaded', error);
            // Pushing before the server's cart was read would overwrite it; try again with the next change.
            this.initial = undefined;
        } finally {
            this.syncing = false;
            if (this.dirty) {
                this.dirty = false;
                this.schedulePush();
            }
        }
    }

    /** Server lines first, then the lines this device collected that the account does not know yet. */
    private merge(serverLines: AccountCartLine[]): CartItem[] {
        const local = this.cart.items();
        const used = new Set<string>();
        const fromServer = serverLines.map((line) => {
            // After a logout the device lost its server ids; the same configuration is the same line.
            const match =
                local.find((item) => item.serverId === line.id) ??
                local.find((item) => !item.serverId && !used.has(item.id) && sameConfiguration(item, line));
            if (match) {
                used.add(match.id);
            }
            return toCartItem(line, match);
        });
        const fresh = local.filter((item) => !item.serverId && !used.has(item.id));

        const merged = [...fromServer, ...fresh];
        if (merged.length > CART_MAX_ITEMS) {
            this.noticeState.set({ dropped: merged.length - CART_MAX_ITEMS });
        }
        return merged.slice(0, CART_MAX_ITEMS);
    }

    private localChange() {
        if (!this.account.isSignedIn()) {
            return;
        }
        if (!this.initial) {
            // The first merge failed or has not started; it takes the change along.
            void this.ensureSynced();
            return;
        }
        if (this.syncing) {
            this.dirty = true;
            return;
        }
        this.schedulePush();
    }

    private schedulePush() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), CART_SYNC_DEBOUNCE_MS);
    }

    private flush(): Promise<void> {
        this.pushing = this.pushing.then(() => this.push()).catch((error: unknown) => {
            console.warn('The account cart could not be saved', error);
        });
        return this.pushing;
    }

    private signedOut() {
        if (!this.signedInSeen) {
            return;
        }
        this.signedInSeen = false;
        this.initial = undefined;
        this.dirty = false;
        clearTimeout(this.timer);
        this.noticeState.set(null);
        this.cart.detachFromAccount();
    }

    /** Writes the cart as it is now; repairs what the backend refuses and retries. */
    private async push() {
        if (!this.account.isSignedIn()) {
            return;
        }
        if (this.cart.isEmpty()) {
            await firstValueFrom(this.api.clear());
            return;
        }

        const refreshed = new Set<string>();
        let detached = false;
        for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
            const sent = this.cart.items();
            try {
                const response = await firstValueFrom(this.api.replace(sent.map(toRequestLine)));
                if (this.account.isSignedIn() && response.items.length === sent.length) {
                    this.cart.attachServerIds(new Map(sent.map((item, index) => [item.id, response.items[index].id])));
                }
                return;
            } catch (error) {
                const code = cartProblemCode(error);
                const index = cartProblemItemIndex(error);
                const expired = code === 'model-expired' && index !== null ? sent[index] : undefined;
                if (expired?.file && !refreshed.has(expired.id)) {
                    // The upload of a new line is gone: upload the file again and retry once.
                    refreshed.add(expired.id);
                    await firstValueFrom(this.cart.refreshModel(expired.id));
                } else if (code === 'cart-item-not-found' && !detached) {
                    // The account cart was emptied elsewhere; the lines this device has files for start over.
                    detached = true;
                    this.cart.detachFromAccount();
                } else {
                    throw error;
                }
            }
        }
    }
}

function toRequestLine(item: CartItem): AccountCartLineRequest {
    const line = {
        fileName: item.fileName,
        filament: item.filament,
        colorId: item.color.code,
        quality: item.quality,
        quantity: item.quantity,
        quote: item.quote as unknown as Record<string, unknown>
    };
    return item.serverId ? { id: item.serverId, ...line } : { modelId: item.modelId, ...line };
}

function sameConfiguration(item: CartItem, line: AccountCartLine): boolean {
    return (
        item.fileName === line.fileName &&
        item.sizeBytes === line.sizeBytes &&
        item.filament === line.filament &&
        item.color.code === line.colorId &&
        item.quality === line.quality
    );
}

/**
 * A line of the account cart as a local one. A line this device has the file for keeps its local
 * id, file and upload id; one from another device has none of them until the server registers
 * its stored file again.
 */
function toCartItem(line: AccountCartLine, local?: CartItem): CartItem {
    const quote = line.quote as unknown as QuoteResponse;
    const color: ColorOption = quote.color ?? { code: line.colorId, label: line.colorId, hex: '#9e9e9e', pricePerKgChf: 0 };
    return {
        id: local?.id ?? line.id,
        serverId: line.id,
        fileName: line.fileName,
        sizeBytes: line.sizeBytes,
        modelId: local?.modelId ?? '',
        filament: line.filament,
        color,
        quality: line.quality,
        quantity: line.quantity,
        quote,
        file: local?.file
    };
}
