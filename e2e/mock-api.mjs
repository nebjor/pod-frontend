// Dependency-free stand-in for the backend API, with fixtures shaped like src/app/core/api/openapi.d.ts.
// Runtime switches (so one process serves every page of the smoke test):
//   STUB_ACCOUNT=1 or POST /api/__mock/config {"account":true}  -> GET /api/account returns a customer
//   POST /api/__mock/config {"quoteDelayMs":1500}                -> POST /api/quotes answers late
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const config = {
    account: Boolean(process.env.STUB_ACCOUNT),
    quoteDelayMs: Number(process.env.QUOTE_DELAY_MS ?? 0)
};

const color = (code, label, hex, pricePerKgChf) => ({ code, label, hex, pricePerKgChf });

const options = {
    filaments: [
        {
            code: 'PLA',
            label: 'PLA',
            profileName: 'Bambu PLA Basic @BBL A1',
            colors: [
                color('black', 'Charcoal Black (matt)', '#2b2b2b', 36),
                color('white', 'Cotton White (matt)', '#f1ede3', 36),
                color('red', 'Red', '#d62828', 45)
            ]
        },
        {
            code: 'PETG',
            label: 'PETG',
            profileName: 'PolyLite PETG @BBL A1',
            colors: [color('black', 'Black', '#1f1f1f', 45), color('white', 'White', '#f2f2f2', 45)]
        },
        {
            code: 'PCTG',
            label: 'PCTG',
            profileName: 'Generic PCTG @BBL A1',
            colors: [color('clear', 'Clear', '#e8f1f5', 52), color('black', 'Black', '#1f1f1f', 52)]
        }
    ],
    qualities: [
        { code: 'coarse', label: 'Grob', profileName: '0.24mm Draft @BBL A1', layerHeightMm: 0.24, baseLeadTimeDays: 2 },
        { code: 'medium', label: 'Standard', profileName: '0.20mm Standard @BBL A1', layerHeightMm: 0.2, baseLeadTimeDays: 3 },
        { code: 'high', label: 'Fein', profileName: '0.12mm Fine @BBL A1', layerHeightMm: 0.12, baseLeadTimeDays: 4 }
    ],
    maxQuantity: 100
};

const settings = {
    currency: 'CHF',
    shippingFlatChf: 9,
    setupFeeChf: 5,
    setupFeeAccountChf: 3,
    vatEnabled: false,
    vatRate: 0.081,
    quoteValidityDays: 14,
    shipToCountries: ['CH']
};

const account = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Unterwegli 1',
    postalCode: '8404',
    city: 'Winterthur',
    country: 'CH',
    createdAt: '2026-10-01T10:00:00Z',
    lastLoginAt: '2026-10-22T10:00:00Z',
    hasPassword: true
};

const orderItem = {
    position: 1,
    fileName: '3DBenchy.stl',
    filament: 'PLA',
    color: { code: 'black', hex: '#2b2b2b' },
    quality: 'medium',
    quantity: 1,
    unitPriceChf: 3.15,
    lineTotalChf: 3.15,
    printTimeSeconds: 2438,
    filamentGrams: 12.4
};

const order = (status = 'PAID') => ({
    orderNumber: 'POD-1001',
    createdAt: '2026-10-20T09:30:00Z',
    customerEmail: 'anna@example.com',
    customerName: 'Anna Muster',
    items: [orderItem],
    paidAt: status === 'NEW' ? null : '2026-10-20T09:31:00Z',
    paymentUrl: null,
    quoteExpiresAt: '2026-11-03T09:30:00Z',
    status,
    totals: { currency: 'CHF', itemsTotal: 3.15, setupFee: 5, shipping: 9, total: 17.15, vatAmount: 0, vatRate: 0 },
    vatNote: null
});

function quoteFor(form) {
    const filament = options.filaments.find((f) => f.code === form.filament) ?? options.filaments[0];
    const colour = filament.colors.find((c) => c.code === form.color) ?? filament.colors[0];
    const quality = options.qualities.find((q) => q.code === form.quality) ?? options.qualities[1];
    const quantity = Math.max(1, Math.min(options.maxQuantity, Number(form.quantity) || 1));
    const unit = quantity >= 4 ? 3.0 : 3.15;
    return {
        fileName: form.fileName ?? '3DBenchy.stl',
        filament: filament.code,
        color: colour,
        quality: quality.code,
        quantity,
        machineProfile: 'Bambu Lab A1 0.4 nozzle',
        layerHeightMm: quality.layerHeightMm,
        plateCount: 1,
        printTimeSeconds: 2438,
        totalPrintTimeSeconds: 2438 * quantity,
        filamentLengthMm: 4160.2,
        filamentGrams: 12.4,
        totalFilamentGrams: Math.round(12.4 * quantity * 10) / 10,
        boundingBoxMm: { widthMm: 60, depthMm: 31, heightMm: 48 },
        triangleCount: 225154,
        machineCostChf: 2.6,
        materialCostChf: 0.55,
        unitPriceChf: unit,
        unitPriceSingleChf: 3.15,
        totalPriceChf: Math.round(unit * quantity * 100) / 100,
        currency: 'CHF',
        leadTimeDays: 3,
        warnings: quantity >= 10 ? ['Thin walls detected: some details may not print cleanly.'] : [],
        manifold: true
    };
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/** Pulls the plain text fields out of a multipart body; the file part is ignored. */
function multipartFields(body, contentType) {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType ?? '');
    const fields = {};
    if (!boundary) return fields;
    for (const part of body.toString('latin1').split('--' + (boundary[1] ?? boundary[2]))) {
        const match = /name="([^"]+)"(?![^\r\n]*filename)[^\r\n]*\r\n\r\n([\s\S]*?)\r\n$/.exec(part);
        if (match) fields[match[1]] = match[2];
    }
    return fields;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createMockServer() {
    let cartItems = [];
    return http.createServer(async (req, res) => {
        const json = (status, body) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        const path = new URL(req.url, 'http://mock').pathname;
        const body = await readBody(req);
        const key = `${req.method} ${path}`;

        if (key === 'POST /api/__mock/config') {
            Object.assign(config, JSON.parse(body.toString() || '{}'));
            return json(200, config);
        }
        if (key === 'GET /api/quotes/options') return json(200, options);
        if (key === 'GET /api/orders/settings') return json(200, settings);
        if (key === 'POST /api/models') {
            return json(201, { modelId: 'a'.repeat(64), fileName: '3DBenchy.stl', sizeBytes: 28 });
        }
        if (key === 'POST /api/quotes') {
            await sleep(config.quoteDelayMs);
            return json(200, quoteFor(multipartFields(body, req.headers['content-type'])));
        }
        if (path === '/api/account' && req.method === 'GET') {
            return config.account ? json(200, account) : json(401, { code: 'not-logged-in' });
        }
        if (path === '/api/account' && req.method === 'PUT') {
            return json(200, { ...account, ...JSON.parse(body.toString() || '{}') });
        }
        if (key === 'GET /api/account/orders') return json(200, config.account ? [order('PRINTING')] : []);
        if (key === 'GET /api/account/cart') return json(200, { items: cartItems });
        if (key === 'PUT /api/account/cart') {
            const request = JSON.parse(body.toString() || '{"items":[]}');
            cartItems = request.items.map((item, position) => ({
                sizeBytes: 28,
                ...item,
                id: item.id ?? crypto.randomUUID(),
                position,
                quantity: item.quantity ?? 1,
                updatedAt: '2026-10-22T10:00:00Z'
            }));
            return json(200, { items: cartItems });
        }
        if (key === 'DELETE /api/account/cart') {
            cartItems = [];
            return json(204, {});
        }
        if (key === 'POST /api/orders') {
            return json(201, { ...order('NEW'), paymentUrl: '/pay/mock?order=POD-1001' });
        }
        if (req.method === 'GET' && path.startsWith('/api/orders/POD-')) return json(200, order('PAID'));
        if (req.method === 'POST' && path.startsWith('/api/account/')) return json(204, {});
        return json(404, { code: 'not-found', detail: `No mock for ${key}` });
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const port = Number(process.argv[2] ?? process.env.MOCK_PORT ?? 8099);
    createMockServer().listen(port, () => console.log(`mock api on ${port}`));
}
