// Visual smoke: every customer page at 1366 px and 390 px must render without sideways scroll,
// console errors, clipped text, cut sentences or duplicate buttons. See e2e/README.md.
import { expect, test } from '@playwright/test';
import {
    auditPage,
    canvasHasPixels,
    chooseModel,
    configureMock,
    screenshot,
    settle,
    signInViaStub,
    signOutViaStub,
    switchLanguage
} from './helpers.mjs';

const WIDTHS = [
    { width: 1366, height: 900 },
    { width: 390, height: 844 }
];

const calculate = (page) => page.getByRole('button', { name: 'Preis berechnen' });

/** Runs the whole flow up to a quote and waits for it. */
async function reachQuote(page, quantity) {
    await chooseModel(page);
    if (quantity) await page.locator('input[formcontrolname=quantity]').fill(String(quantity));
    await calculate(page).click();
    await page.getByRole('button', { name: 'In den Warenkorb' }).waitFor();
}

/**
 * One entry per page state. `open` brings the browser there; `german` enables the German-only
 * checks; `viewer` asserts that the WebGL canvas draws; `account` signs in through the stub.
 */
const PAGES = [
    { name: 'landing', open: (page) => page.goto('/'), german: true },
    {
        name: 'upload-dropzone',
        open: async (page) => {
            await page.goto('/upload');
            await page.locator('input[type=file]').waitFor({ state: 'attached' });
        },
        german: true
    },
    { name: 'upload-configure', open: chooseModel, german: true, viewer: true },
    {
        name: 'upload-loading',
        open: async (page) => {
            await configureMock({ quoteDelayMs: 4000 });
            await chooseModel(page);
            await calculate(page).click();
            await page.getByRole('heading', { name: 'Preis wird berechnet' }).waitFor();
            await page.locator('.loading-panel').waitFor();
        },
        // The loading card is only there until the quote arrives: audit it immediately, then
        // let the quote finish so nothing is left in flight.
        loading: true,
        finish: (page) => page.getByRole('button', { name: 'In den Warenkorb' }).waitFor({ timeout: 15_000 }),
        cleanup: () => configureMock({ quoteDelayMs: 0 }),
        german: true
    },
    { name: 'upload-quote', open: (page) => reachQuote(page), german: true, viewer: true },
    { name: 'upload-quote-qty4', open: (page) => reachQuote(page, 4), german: true, viewer: true, discount: '.price .discount' },
    {
        name: 'cart',
        open: async (page) => {
            await reachQuote(page, 4);
            await page.getByRole('button', { name: 'In den Warenkorb' }).click();
            await page.goto('/warenkorb');
            await page.getByText('3DBenchy.stl').first().waitFor();
        },
        german: true,
        discount: '.discount'
    },
    {
        name: 'checkout',
        open: async (page) => {
            await reachQuote(page);
            await page.getByRole('button', { name: 'In den Warenkorb' }).click();
            await page.goto('/checkout');
            await page.locator('form.customer-form').waitFor();
        },
        german: true,
        account: true
    },
    {
        // Ordering needs an account: an anonymous customer lands on the login with the way back.
        name: 'checkout-signed-out',
        open: async (page) => {
            await reachQuote(page);
            await page.getByRole('button', { name: 'In den Warenkorb' }).click();
            await page.goto('/checkout');
            await page.waitForURL(/\/konto\/anmelden\?returnTo=%2Fcheckout/);
            await page.getByRole('button', { name: 'Anmelden' }).first().waitFor();
        },
        german: true
    },
    { name: 'login', open: (page) => page.goto('/konto/anmelden'), german: true },
    { name: 'account-orders', open: (page) => page.goto('/konto/bestellungen'), german: true, account: true },
    { name: 'account-order', open: (page) => page.goto('/konto/bestellungen/POD-1001'), german: true, account: true },
    { name: 'account-address', open: (page) => page.goto('/konto/adresse'), german: true, account: true },
    { name: 'account-password', open: (page) => page.goto('/konto/passwort'), german: true, account: true },
    { name: 'about', open: (page) => page.goto('/ueber-uns'), german: true },
    { name: 'imprint', open: (page) => page.goto('/impressum'), german: true },
    {
        name: 'landing-fr',
        open: async (page) => {
            await page.goto('/');
            await switchLanguage(page, 'Français');
        },
        german: false
    }
];

/** The anonymous probe of GET /api/account is part of every page load and expected to fail. */
const isExpected401 = (message) => message.type() === 'error' && message.location().url.includes('/api/account') && /401/.test(message.text());

/**
 * What a crawler gets: the served HTML must be the prerendered page with its own title and
 * robots tag, not the bare client shell (the fault behind a missing proxy header, see serve.mjs).
 */
test.describe('served HTML', () => {
    const html = async (path) => (await fetch(`http://127.0.0.1:${process.env.E2E_PORT ?? 4310}${path}`)).text();
    const titleOf = (source) => /<title>([^<]+)<\/title>/.exec(source)?.[1] ?? '';

    test('indexable pages carry their own title and "index, follow"', async () => {
        const titles = [];
        for (const path of ['/', '/upload', '/agb']) {
            const source = await html(path);
            expect(source, path).toContain('<meta name="robots" content="index, follow">');
            titles.push(titleOf(source));
        }
        expect(titles.every(Boolean)).toBe(true);
        expect(new Set(titles).size, `titles differ per page: ${titles.join(' | ')}`).toBe(titles.length);
    });

    test('the cart is noindex', async () => {
        expect(await html('/warenkorb')).toMatch(/<meta name="robots" content="noindex/);
    });
});

for (const { width, height } of WIDTHS) {
    test.describe(`at ${width} px`, () => {
        test.use({ viewport: { width, height } });

        for (const entry of PAGES) {
            test(entry.name, async ({ page }) => {
                const errors = [];
                page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
                page.on('console', (message) => {
                    if (message.type() === 'error' && !isExpected401(message)) {
                        errors.push(`console: ${message.text()} (${message.location().url})`);
                    }
                });

                if (entry.account) await signInViaStub();
                try {
                    await entry.open(page);
                    if (!entry.loading) {
                        await settle(page);
                        await page.waitForTimeout(400);
                    }

                    if (entry.discount) {
                        await expect(page.locator(entry.discount).first()).toHaveText(/\d+ % Mengenrabatt/);
                    }
                    if (entry.viewer) {
                        await expect.poll(() => canvasHasPixels(page), { message: 'viewer canvas draws', timeout: 20_000 }).toBe(true);
                    }

                    await screenshot(page, entry.name, width);
                    const problems = await page.evaluate(auditPage, { german: entry.german });
                    expect([...errors, ...problems]).toEqual([]);
                    await entry.finish?.(page);
                } finally {
                    if (entry.account) await signOutViaStub();
                    await entry.cleanup?.();
                }
            });
        }
    });
}
