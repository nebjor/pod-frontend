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
            await configureMock({ quoteDelayMs: 1500 });
            await chooseModel(page);
            await calculate(page).click();
            await page.getByRole('heading', { name: 'Preis wird berechnet' }).waitFor();
        },
        cleanup: () => configureMock({ quoteDelayMs: 0 }),
        german: true
    },
    { name: 'upload-quote', open: (page) => reachQuote(page), german: true, viewer: true },
    { name: 'upload-quote-qty4', open: (page) => reachQuote(page, 4), german: true, viewer: true, expectText: /%/ },
    {
        name: 'cart',
        open: async (page) => {
            await reachQuote(page);
            await page.getByRole('button', { name: 'In den Warenkorb' }).click();
            await page.goto('/warenkorb');
            await page.getByText('3DBenchy.stl').first().waitFor();
        },
        german: true
    },
    {
        name: 'checkout',
        open: async (page) => {
            await reachQuote(page);
            await page.getByRole('button', { name: 'In den Warenkorb' }).click();
            await page.goto('/checkout');
            await page.locator('form.customer-form, form').first().waitFor();
        },
        german: true
    },
    { name: 'order', open: (page) => page.goto('/bestellung?nr=POD-1001&email=anna@example.com'), german: true },
    { name: 'login', open: (page) => page.goto('/konto/anmelden'), german: true },
    { name: 'account', open: (page) => page.goto('/konto'), german: true, account: true },
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
                    await settle(page);
                    await page.waitForTimeout(400);

                    if (entry.expectText) {
                        await expect(page.locator('main, app-root').first()).toContainText(entry.expectText);
                    }
                    if (entry.viewer) {
                        await expect.poll(() => canvasHasPixels(page), { message: 'viewer canvas draws', timeout: 20_000 }).toBe(true);
                    }

                    await screenshot(page, entry.name, width);
                    const problems = await page.evaluate(auditPage, { german: entry.german });
                    expect([...errors, ...problems]).toEqual([]);
                } finally {
                    if (entry.account) await signOutViaStub();
                    await entry.cleanup?.();
                }
            });
        }
    });
}
