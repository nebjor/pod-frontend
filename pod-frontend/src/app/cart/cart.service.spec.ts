import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService, UploadEvent } from '../quote/quote.service';
import { AccountCartApi } from './account-cart.api';
import { CART_STORAGE_KEY, CartStorage, StoredCartItem } from './cart-storage';
import { CART_MAX_ITEMS, CartService, NewCartItem } from './cart.service';

const quote: QuoteResponse = {
    fileName: 'benchy.stl',
    filament: 'PLA',
    color: { code: 'black', label: 'Black', hex: '#1f1f1f', pricePerKgChf: 36 },
    quality: 'medium',
    quantity: 1,
    machineProfile: 'Bambu Lab A1 0.4 nozzle',
    layerHeightMm: 0.2,
    plateCount: 1,
    printTimeSeconds: 2239,
    totalPrintTimeSeconds: 2239,
    filamentLengthMm: 3880.6,
    filamentGrams: 11.6,
    totalFilamentGrams: 11.6,
    boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
    triangleCount: 225154,
    machineCostChf: 2.5,
    materialCostChf: 0.4,
    setupFeeChf: 5,
    unitPriceChf: 3,
    totalPriceChf: 8,
    currency: 'CHF',
    leadTimeDays: 3,
    warnings: [],
    manifold: true
};

const MODEL_ID = 'a'.repeat(64);
const NEW_MODEL_ID = 'b'.repeat(64);

function newItem(name = 'benchy.stl', overrides: Partial<NewCartItem> = {}): NewCartItem {
    const file = new File(['solid benchy endsolid benchy'], name);
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

/** In-memory stand-in for localStorage plus IndexedDB; shared between service instances. */
class MemoryCartStorage implements Pick<CartStorage, keyof CartStorage> {
    items: StoredCartItem[] = [];
    files = new Map<string, File>();
    listeners: Array<() => void> = [];

    /** Simulates a write by another tab: replaces the metadata and notifies the listeners. */
    writtenElsewhere(items: StoredCartItem[]) {
        this.items = items.map((item) => ({ ...item }));
        this.listeners.forEach((listener) => listener());
    }

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
    onChange(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
}

function serverLine(id: string): StoredCartItem {
    return {
        id,
        serverId: id,
        fileName: 'benchy.stl',
        sizeBytes: 28,
        modelId: '',
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 1,
        quote
    };
}

describe('CartService', () => {
    let storage: MemoryCartStorage;
    let requestQuote: ReturnType<typeof vi.fn>;
    let uploadModel: ReturnType<typeof vi.fn>;
    let registerModel: ReturnType<typeof vi.fn>;

    function configure(platform: 'browser' | 'server' = 'browser') {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                { provide: CartStorage, useValue: storage },
                { provide: QuoteService, useValue: { requestQuote, uploadModel } },
                { provide: AccountCartApi, useValue: { registerModel } },
                { provide: PLATFORM_ID, useValue: platform }
            ]
        });
        return TestBed.inject(CartService);
    }

    beforeEach(() => {
        storage = new MemoryCartStorage();
        requestQuote = vi.fn(() => of(quote));
        registerModel = vi.fn(() => of({ modelId: NEW_MODEL_ID, fileName: 'benchy.stl', sizeBytes: 28 }));
        uploadModel = vi.fn(() => of<UploadEvent>({ kind: 'done', model: { modelId: NEW_MODEL_ID, fileName: 'benchy.stl', sizeBytes: 28 } }));
    });

    it('adds lines with their own ids and derives count, total and emptiness', () => {
        const cart = configure();
        expect(cart.isEmpty()).toBe(true);

        const first = cart.add(newItem('benchy.stl', { quantity: 2, quote: { ...quote, totalPriceChf: 11 } }));
        const second = cart.add(newItem('cube.stl', { quote: { ...quote, totalPriceChf: 6.85 } }));

        expect(first?.id).toBeTruthy();
        expect(second?.id).not.toBe(first?.id);
        expect(cart.items().map((item) => item.fileName)).toEqual(['benchy.stl', 'cube.stl']);
        expect(cart.count()).toBe(3);
        expect(cart.itemsTotal()).toBe(17.85);
        expect(cart.isEmpty()).toBe(false);
        expect(cart.isFull()).toBe(false);
    });

    it('refuses more lines than an order may have', () => {
        const cart = configure();
        for (let index = 0; index < CART_MAX_ITEMS; index++) {
            expect(cart.add(newItem(`part-${index}.stl`))).not.toBeNull();
        }

        expect(cart.isFull()).toBe(true);
        expect(cart.add(newItem('one-too-many.stl'))).toBeNull();
        expect(cart.items()).toHaveLength(CART_MAX_ITEMS);
    });

    it('removes a line and clears the cart, dropping the stored files with them', async () => {
        const cart = configure();
        const first = cart.add(newItem('benchy.stl'))!;
        const second = cart.add(newItem('cube.stl'))!;
        await Promise.resolve();
        expect([...storage.files.keys()]).toEqual([first.id, second.id]);

        cart.remove(first.id);
        await Promise.resolve();
        expect(cart.items().map((item) => item.id)).toEqual([second.id]);
        expect(storage.items.map((item) => item.id)).toEqual([second.id]);
        expect(storage.files.has(first.id)).toBe(false);

        cart.clear();
        await Promise.resolve();
        expect(cart.isEmpty()).toBe(true);
        expect(storage.items).toEqual([]);
        expect(storage.files.size).toBe(0);
    });

    it('re-quotes a line by model id when its quantity changes and keeps the new quote', () => {
        const cart = configure();
        const item = cart.add(newItem())!;
        requestQuote.mockReturnValueOnce(of({ ...quote, quantity: 3, totalPriceChf: 14 }));

        let received: QuoteResponse | undefined;
        cart.updateQuantity(item.id, 3).subscribe((result) => (received = result));

        expect(requestQuote).toHaveBeenCalledWith(MODEL_ID, { filament: 'PLA', color: 'black', quality: 'medium', quantity: 3 });
        expect(received?.totalPriceChf).toBe(14);
        expect(cart.find(item.id)).toMatchObject({ quantity: 3, quote: { totalPriceChf: 14 } });
        expect(cart.itemsTotal()).toBe(14);
        expect(storage.items[0]).toMatchObject({ quantity: 3 });
    });

    it('uploads the file again when the backend has dropped the model, then retries the quote', () => {
        const cart = configure();
        const item = cart.add(newItem())!;
        requestQuote
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'model-expired' } })))
            .mockReturnValueOnce(of({ ...quote, quantity: 2, totalPriceChf: 11 }));

        let received: QuoteResponse | undefined;
        cart.updateQuantity(item.id, 2).subscribe((result) => (received = result));

        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(uploadModel.mock.calls[0][0]).toBe(item.file);
        expect(requestQuote).toHaveBeenCalledTimes(2);
        expect(requestQuote.mock.calls[1][0]).toBe(NEW_MODEL_ID);
        expect(received?.totalPriceChf).toBe(11);
        expect(cart.find(item.id)).toMatchObject({ modelId: NEW_MODEL_ID, quantity: 2 });
    });

    it('refreshModel uploads the local file when there is one', () => {
        const cart = configure();
        const item = cart.add(newItem())!;

        let modelId = '';
        cart.refreshModel(item.id).subscribe((id) => (modelId = id));

        expect(modelId).toBe(NEW_MODEL_ID);
        expect(uploadModel).toHaveBeenCalledTimes(1);
        expect(registerModel).not.toHaveBeenCalled();
        expect(cart.find(item.id)?.modelId).toBe(NEW_MODEL_ID);
    });

    it('refreshModel asks the server for its stored copy when the line has no file', async () => {
        storage.items = [serverLine('srv-1')];
        const cart = configure();
        await cart.restore();

        let modelId = '';
        cart.refreshModel('srv-1').subscribe((id) => (modelId = id));

        expect(modelId).toBe(NEW_MODEL_ID);
        expect(registerModel).toHaveBeenCalledWith('srv-1');
        expect(uploadModel).not.toHaveBeenCalled();
        expect(cart.find('srv-1')?.modelId).toBe(NEW_MODEL_ID);
    });

    it('does not announce a model refresh as a customer change', async () => {
        storage.items = [serverLine('srv-1')];
        const cart = configure();
        await cart.restore();
        const changed = vi.fn();
        cart.changes.subscribe(changed);

        cart.refreshModel('srv-1').subscribe();
        expect(changed).not.toHaveBeenCalled();

        cart.updateQuantity('srv-1', 2).subscribe();
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it('registers the stored file first when a line from the account cart is re-quoted', async () => {
        storage.items = [serverLine('srv-1')];
        const cart = configure();
        await cart.restore();

        cart.updateQuantity('srv-1', 2).subscribe();

        expect(registerModel).toHaveBeenCalledWith('srv-1');
        expect(requestQuote.mock.calls[0][0]).toBe(NEW_MODEL_ID);
    });

    it('ensureModelIds registers only the lines that have no upload id', async () => {
        storage.items = [serverLine('srv-1'), { ...serverLine('srv-2'), modelId: MODEL_ID }];
        const cart = configure();
        await cart.restore();

        await new Promise<void>((resolve) => cart.ensureModelIds().subscribe({ complete: resolve }));

        expect(registerModel).toHaveBeenCalledTimes(1);
        expect(cart.find('srv-1')?.modelId).toBe(NEW_MODEL_ID);
        expect(cart.find('srv-2')?.modelId).toBe(MODEL_ID);
    });

    it('keeps account cart lines without a file when restoring and drops other lines without one', async () => {
        storage.items = [serverLine('srv-1'), { ...serverLine('local-1'), serverId: undefined }];
        const cart = configure();
        await cart.restore();

        expect(cart.items().map((item) => item.id)).toEqual(['srv-1']);
    });

    it('detaches from the account: keeps lines with a file, drops server ids and file-less lines', async () => {
        const cart = configure();
        const own = cart.add(newItem('benchy.stl'))!;
        cart.attachServerIds(new Map([[own.id, 'srv-own']]));
        cart.replaceAll([...cart.items(), { ...serverLine('srv-1'), id: 'srv-1' }]);

        cart.detachFromAccount();

        expect(cart.items().map((item) => item.id)).toEqual([own.id]);
        expect(cart.find(own.id)?.serverId).toBeUndefined();
        expect(storage.items.map((item) => item.serverId)).toEqual([undefined]);
    });

    it('reports other quote failures and leaves the line unchanged', () => {
        const cart = configure();
        const item = cart.add(newItem())!;
        requestQuote.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 429 })));

        let failure: unknown;
        cart.updateQuantity(item.id, 2).subscribe({ error: (error: unknown) => (failure = error) });

        expect(failure).toBeInstanceOf(HttpErrorResponse);
        expect(uploadModel).not.toHaveBeenCalled();
        expect(cart.find(item.id)?.quantity).toBe(1);
    });

    it('replaces a quote after a price change', () => {
        const cart = configure();
        const item = cart.add(newItem())!;

        cart.replaceQuote(item.id, { ...quote, totalPriceChf: 9.5 });

        expect(cart.find(item.id)?.quote.totalPriceChf).toBe(9.5);
        expect(storage.items[0].quote.totalPriceChf).toBe(9.5);
    });

    it('survives a reload: metadata and files are restored in order, lines without a file are dropped', async () => {
        const before = configure();
        const kept = before.add(newItem('benchy.stl', { quantity: 2 }))!;
        const lost = before.add(newItem('cube.stl'))!;
        await Promise.resolve();
        storage.files.delete(lost.id);
        storage.files.set('orphan', new File(['x'], 'orphan.stl'));

        const after = configure();
        expect(after.ready()).toBe(false);
        expect(after.isEmpty()).toBe(true);
        await after.restore();

        expect(after.ready()).toBe(true);
        expect(after.items().map((item) => item.id)).toEqual([kept.id]);
        expect(after.find(kept.id)).toMatchObject({ fileName: 'benchy.stl', quantity: 2, modelId: MODEL_ID });
        expect(after.find(kept.id)?.file?.name).toBe('benchy.stl');
        // The dropped line and the orphaned blob are gone from storage as well.
        expect(storage.items.map((item) => item.id)).toEqual([kept.id]);
        await Promise.resolve();
        expect([...storage.files.keys()]).toEqual([kept.id]);
    });

    it('keeps a line added while the persisted cart was still loading', async () => {
        const before = configure();
        const persisted = before.add(newItem('benchy.stl'))!;
        await Promise.resolve();

        const after = configure();
        const restoring = after.restore();
        const fresh = after.add(newItem('cube.stl'))!;
        await restoring;

        expect(after.items().map((item) => item.id)).toEqual([persisted.id, fresh.id]);
    });

    it("takes over another tab's cart: new lines read their file, removed lines go, nothing is written back", async () => {
        const cart = configure();
        const kept = cart.add(newItem('benchy.stl'))!;
        const removedElsewhere = cart.add(newItem('cube.stl'))!;
        await Promise.resolve();
        const addedElsewhere: StoredCartItem = { ...storage.items[0], id: 'other-tab', fileName: 'ragno.3mf', quantity: 4 };
        storage.files.set('other-tab', new File(['r'], 'ragno.3mf'));
        const writeItems = vi.spyOn(storage, 'writeItems');

        storage.writtenElsewhere([addedElsewhere, { ...storage.items[0], quantity: 7 }]);
        await cart.sync();

        expect(cart.items().map((item) => item.id)).toEqual(['other-tab', kept.id]);
        expect(cart.find(kept.id)).toMatchObject({ quantity: 7 });
        expect(cart.find('other-tab')?.file?.name).toBe('ragno.3mf');
        expect(cart.find(removedElsewhere.id)).toBeUndefined();
        expect(writeItems).not.toHaveBeenCalled();
        expect(cart.count()).toBe(11);
    });

    it('starts empty and ready on the server without touching storage', () => {
        const readItems = vi.spyOn(storage, 'readItems');
        const cart = configure('server');

        expect(cart.ready()).toBe(true);
        expect(cart.isEmpty()).toBe(true);
        expect(readItems).not.toHaveBeenCalled();
    });
});

describe('CartStorage', () => {
    afterEach(() => localStorage.clear());

    function configure(platform: 'browser' | 'server') {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
        return TestBed.inject(CartStorage);
    }

    const stored: StoredCartItem = {
        id: 'line-1',
        fileName: 'benchy.stl',
        sizeBytes: 28,
        modelId: MODEL_ID,
        filament: 'PLA',
        color: quote.color,
        quality: 'medium',
        quantity: 1,
        quote
    };

    it('round-trips the line metadata through localStorage and removes the key with the last line', () => {
        const storage = configure('browser');

        storage.writeItems([stored]);
        expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}').items).toHaveLength(1);
        expect(storage.readItems()).toEqual([stored]);

        storage.writeItems([]);
        expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    });

    it('ignores corrupt or foreign data', () => {
        const storage = configure('browser');

        localStorage.setItem(CART_STORAGE_KEY, 'not json');
        expect(storage.readItems()).toEqual([]);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 99, items: [stored] }));
        expect(storage.readItems()).toEqual([]);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ id: 'x' }, stored] }));
        expect(storage.readItems()).toEqual([stored]);
    });

    it('degrades to nothing stored where IndexedDB is missing', async () => {
        const storage = configure('browser');
        expect(typeof indexedDB).toBe('undefined');

        await expect(storage.putFile('line-1', new File(['x'], 'benchy.stl'))).resolves.toBeUndefined();
        await expect(storage.getFile('line-1')).resolves.toBeNull();
        await expect(storage.pruneFiles([])).resolves.toBeUndefined();
    });

    it('neither reads nor writes on the server', () => {
        const storage = configure('server');
        sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, items: [stored] }));

        expect(storage.readItems()).toEqual([]);
        storage.writeItems([]);
        expect(sessionStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
    });
});
