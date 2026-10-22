import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AccountService } from '../account/account.service';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent } from '../quote/quote.service';
import { AccountCartApi, AccountCartLine, AccountCartLineRequest } from './account-cart.api';
import { CART_SYNC_DEBOUNCE_MS, CartSyncService } from './cart-sync.service';
import { CartStorage, StoredCartItem } from './cart-storage';
import { CART_MAX_ITEMS, CartService, NewCartItem } from './cart.service';

const quote = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'black', label: 'Black', hex: '#1f1f1f', pricePerKgChf: 36 },
    quality: 'medium',
    quantity: 1,
    totalPriceChf: 8,
    currency: 'CHF'
} as unknown as QuoteResponse;

const MODEL_ID = 'a'.repeat(64);
const NEW_MODEL_ID = 'b'.repeat(64);

/** Just enough of the browser storage for the cart service. */
class FakeStorage {
    items: StoredCartItem[] = [];
    files = new Map<string, File>();
    readItems() {
        return this.items.map((item) => ({ ...item }));
    }
    writeItems(items: StoredCartItem[]) {
        this.items = items.map((item) => ({ ...item }));
    }
    async putFile(id: string, file: File) {
        this.files.set(id, file);
    }
    async getFile(id: string) {
        return this.files.get(id) ?? null;
    }
    async deleteFile(id: string) {
        this.files.delete(id);
    }
    async pruneFiles(keepIds: ReadonlyArray<string>) {
        for (const id of [...this.files.keys()]) {
            if (!keepIds.includes(id)) {
                this.files.delete(id);
            }
        }
    }
    async clearFiles() {
        this.files.clear();
    }
    onChange() {
        return () => undefined;
    }
}

function newItem(name: string, overrides: Partial<NewCartItem> = {}): NewCartItem {
    const file = new File(['solid'], name);
    return {
        file,
        fileName: name,
        sizeBytes: file.size,
        modelId: MODEL_ID,
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 1,
        quote: { ...quote, fileName: name },
        ...overrides
    };
}

function serverLine(id: string, overrides: Partial<AccountCartLine> = {}): AccountCartLine {
    return {
        id,
        position: 1,
        fileName: `${id}.stl`,
        sizeBytes: 100,
        filament: 'PLA',
        colorId: 'black',
        quality: 'medium',
        quantity: 2,
        quote: { ...quote, fileName: `${id}.stl` } as unknown as AccountCartLine['quote'],
        updatedAt: '2026-10-22T10:00:00Z',
        ...overrides
    };
}

/** The backend's answer to a PUT: stored lines in order; lines sent by upload id get new ids. */
function storedFrom(items: AccountCartLineRequest[]): { items: AccountCartLine[] } {
    return {
        items: items.map((line, index) =>
            serverLine(line.id ?? `new-${index}`, {
                position: index + 1,
                fileName: line.fileName,
                quantity: line.quantity ?? 1
            })
        )
    };
}

describe('CartSyncService', () => {
    let storage: FakeStorage;
    let signedIn: ReturnType<typeof signal<boolean>>;
    let load: ReturnType<typeof vi.fn>;
    let replace: ReturnType<typeof vi.fn>;
    let clear: ReturnType<typeof vi.fn>;
    let registerModel: ReturnType<typeof vi.fn>;
    let uploadModel: ReturnType<typeof vi.fn>;
    let cart: CartService;
    let sync: CartSyncService;

    async function setUp(localItems: NewCartItem[] = []) {
        TestBed.configureTestingModule({
            providers: [
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: CartStorage, useValue: storage },
                { provide: AccountService, useValue: { isSignedIn: signedIn } },
                { provide: AccountCartApi, useValue: { load, replace, clear, registerModel } },
                { provide: QuoteService, useValue: { uploadModel, requestQuote: vi.fn(() => of(quote)) } }
            ]
        });
        cart = TestBed.inject(CartService);
        // The first render triggers the restore, as in the app.
        TestBed.tick();
        await cart.whenReady();
        localItems.forEach((item) => cart.add(item));
        sync = TestBed.inject(CartSyncService);
    }

    /** Signs in and lets the first merge finish. */
    async function signIn() {
        signedIn.set(true);
        TestBed.tick();
        await sync.ensureSynced();
    }

    beforeEach(() => {
        vi.useFakeTimers();
        storage = new FakeStorage();
        signedIn = signal(false);
        load = vi.fn(() => of({ items: [] }));
        replace = vi.fn((items: AccountCartLineRequest[]) => of(storedFrom(items)));
        clear = vi.fn(() => of(undefined));
        registerModel = vi.fn(() => of({ modelId: NEW_MODEL_ID, fileName: 'x.stl', sizeBytes: 1 }));
        uploadModel = vi.fn(() =>
            of<UploadEvent>({ kind: 'done', model: { modelId: NEW_MODEL_ID, fileName: 'x.stl', sizeBytes: 1 } })
        );
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does nothing for a visitor who is not signed in', async () => {
        await setUp([newItem('own.stl')]);
        TestBed.tick();
        await sync.ensureSynced();
        cart.add(newItem('more.stl'));
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS * 2);

        expect(load).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('merges on sign-in: server lines first, then the new local ones, pushed by id and by upload id', async () => {
        load.mockReturnValue(of({ items: [serverLine('srv-a'), serverLine('srv-b', { position: 2 })] }));
        await setUp([newItem('own.stl')]);
        const own = cart.items()[0];

        await signIn();

        expect(replace).toHaveBeenCalledTimes(1);
        const sent = replace.mock.calls[0][0] as AccountCartLineRequest[];
        expect(sent.map((line) => line.id ?? line.modelId)).toEqual(['srv-a', 'srv-b', MODEL_ID]);
        expect(sent[0]).toMatchObject({ fileName: 'srv-a.stl', colorId: 'black', quantity: 2 });

        expect(cart.items().map((item) => item.serverId)).toEqual(['srv-a', 'srv-b', 'new-2']);
        // The server lines have no file, the line of this device keeps its own.
        expect(cart.items().map((item) => !!item.file)).toEqual([false, false, true]);
        expect(cart.items()[2].id).toBe(own.id);
        expect(cart.items()[0].color.code).toBe('black');
        expect(cart.items()[0].modelId).toBe('');
    });

    it('uploads the file again and retries once when the backend reports an expired upload', async () => {
        await setUp([newItem('one.stl'), newItem('two.stl')]);
        const two = cart.items()[1];
        replace
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired', itemIndex: 1 } })))
            .mockImplementation((items: AccountCartLineRequest[]) => of(storedFrom(items)));

        await signIn();

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(uploadModel.mock.calls[0][0]).toBe(two.file);
        expect(replace).toHaveBeenCalledTimes(2);
        expect((replace.mock.calls[1][0] as AccountCartLineRequest[])[1].modelId).toBe(NEW_MODEL_ID);
        expect(cart.items().every((item) => !!item.serverId)).toBe(true);
    });

    it('keeps the first ten lines of a larger merge and tells the customer', async () => {
        load.mockReturnValue(
            of({ items: Array.from({ length: CART_MAX_ITEMS - 1 }, (_, i) => serverLine(`srv-${i}`, { position: i + 1 })) })
        );
        await setUp([newItem('a.stl'), newItem('b.stl'), newItem('c.stl')]);

        await signIn();

        expect((replace.mock.calls[0][0] as AccountCartLineRequest[]).length).toBe(CART_MAX_ITEMS);
        expect(cart.items().length).toBe(CART_MAX_ITEMS);
        expect(cart.items()[CART_MAX_ITEMS - 1].fileName).toBe('a.stl');
        expect(sync.notice()).toEqual({ dropped: 2 });
        sync.dismissNotice();
        expect(sync.notice()).toBeNull();
    });

    it('treats a local line that matches a server line as the same line', async () => {
        const matching = serverLine('srv-a', { fileName: 'own.stl', sizeBytes: 5, quantity: 3 });
        load.mockReturnValue(of({ items: [matching] }));
        await setUp([newItem('own.stl')]);
        const own = cart.items()[0];

        await signIn();

        expect(cart.items().length).toBe(1);
        expect(cart.items()[0]).toMatchObject({ id: own.id, serverId: 'srv-a', quantity: 3 });
        expect(cart.items()[0].file).toBe(own.file);
    });

    it('lets the redirect wait: ensureSynced resolves only after the merged cart is in place', async () => {
        load.mockReturnValue(of({ items: [serverLine('srv-a')] }));
        await setUp();
        signedIn.set(true);

        await sync.ensureSynced();

        expect(cart.items().map((item) => item.serverId)).toEqual(['srv-a']);
    });

    it('does not push without having read the account cart, so a failed load never wipes it', async () => {
        load.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await setUp([newItem('own.stl')]);

        await signIn();
        expect(replace).not.toHaveBeenCalled();

        // The next change tries to read the cart again, now successfully.
        load.mockReturnValue(of({ items: [serverLine('srv-a')] }));
        cart.add(newItem('more.stl'));
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS);

        expect(load).toHaveBeenCalledTimes(2);
        expect((replace.mock.calls[0][0] as AccountCartLineRequest[]).map((line) => line.id ?? line.modelId)).toEqual([
            'srv-a',
            MODEL_ID,
            MODEL_ID
        ]);
    });

    it('pushes the whole cart once, 500 ms after the last change', async () => {
        await setUp();
        await signIn();
        replace.mockClear();

        cart.add(newItem('a.stl'));
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS - 100);
        cart.add(newItem('b.stl'));
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS - 1);
        expect(replace).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(replace).toHaveBeenCalledTimes(1);
        expect((replace.mock.calls[0][0] as AccountCartLineRequest[]).map((line) => line.fileName)).toEqual(['a.stl', 'b.stl']);
    });

    it('pushes quantity changes by line id and does not answer its own response with another push', async () => {
        await setUp([newItem('a.stl')]);
        await signIn();
        replace.mockClear();
        const id = cart.items()[0].id;

        cart.updateQuantity(id, 4).subscribe();
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS);
        expect(replace).toHaveBeenCalledTimes(1);
        const [line] = replace.mock.calls[0][0] as AccountCartLineRequest[];
        expect(line).toMatchObject({ id: 'new-0', quantity: 4 });
        expect(line.modelId).toBeUndefined();

        // The response carried server ids back; that must not schedule anything.
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS * 10);
        expect(replace).toHaveBeenCalledTimes(1);
        expect(clear).not.toHaveBeenCalled();
    });

    it('deletes the account cart when the customer empties the cart', async () => {
        await setUp([newItem('a.stl')]);
        await signIn();
        replace.mockClear();

        cart.clear();
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS);

        expect(clear).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('starts over with the files of this device when the account cart was emptied elsewhere', async () => {
        await setUp([newItem('a.stl')]);
        await signIn();
        replace.mockClear();
        replace
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'cart-item-not-found' } })))
            .mockImplementation((items: AccountCartLineRequest[]) => of(storedFrom(items)));

        cart.updateQuantity(cart.items()[0].id, 2).subscribe();
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS);

        expect(replace).toHaveBeenCalledTimes(2);
        const retried = (replace.mock.calls[1][0] as AccountCartLineRequest[])[0];
        expect(retried.id).toBeUndefined();
        expect(retried.modelId).toBe(MODEL_ID);
    });

    it('keeps the lines with a file on logout, without server ids, and drops the others', async () => {
        load.mockReturnValue(of({ items: [serverLine('srv-a')] }));
        await setUp([newItem('own.stl')]);
        await signIn();
        expect(cart.items().length).toBe(2);
        replace.mockClear();

        signedIn.set(false);
        TestBed.tick();

        expect(cart.items().map((item) => item.fileName)).toEqual(['own.stl']);
        expect(cart.items()[0].serverId).toBeUndefined();
        expect(storage.items.map((item) => item.serverId)).toEqual([undefined]);
        // Nothing is pushed for the sign-out, nor for later changes.
        cart.add(newItem('later.stl'));
        await vi.advanceTimersByTimeAsync(CART_SYNC_DEBOUNCE_MS * 2);
        expect(replace).not.toHaveBeenCalled();
        expect(clear).not.toHaveBeenCalled();
    });
});
