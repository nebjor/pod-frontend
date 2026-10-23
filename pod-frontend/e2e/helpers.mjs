import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SCREENSHOT_DIR = resolve(here, 'screenshots');
export const MODEL_PATH = resolve(here, '../public/3DBenchy.stl');
const MOCK_URL = process.env.E2E_MOCK_URL ?? 'http://127.0.0.1:4312';

/** Changes the mock API at runtime (`account`, `quoteDelayMs`). */
export async function configureMock(settings) {
    const response = await fetch(`${MOCK_URL}/api/__mock/config`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error(`mock config failed: ${response.status}`);
}

/** Opens the language switcher and picks the option whose visible name contains `name`. */
export async function switchLanguage(page, name) {
    await page.locator('app-language-switcher button').first().click();
    await page.locator('app-language-switcher [role=option]', { hasText: name }).click();
    await page.waitForFunction((expected) => document.documentElement.lang === expected, name === 'Français' ? 'fr' : name);
}

/** Signed-in customer: the mock answers GET /api/account with a profile until reset. */
export async function signInViaStub() {
    await configureMock({ account: true });
}

export async function signOutViaStub() {
    await configureMock({ account: false });
}

/** Waits until the page is rendered and the network is quiet. */
export async function settle(page) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts?.ready);
}

/** Chooses the benchy model on /upload and waits for the configuration step. */
export async function chooseModel(page) {
    await page.goto('/upload');
    await page.locator('input[type=file]').setInputFiles(MODEL_PATH);
    await page.locator('select[formcontrolname=filament]').waitFor();
}

export async function screenshot(page, name, width) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, `${name}-${width}.png`), fullPage: true });
}

/**
 * Runs inside the page. Returns a list of human-readable problems; empty means clean.
 * `german` switches on the dangling-preposition check, which only knows German.
 */
export function auditPage({ german }) {
    const problems = [];
    const visible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const label = (el) => `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}> "${(el.textContent ?? '').trim().slice(0, 50)}"`;

    // (a) the page itself never scrolls sideways
    const scroller = document.scrollingElement;
    if (scroller.scrollWidth > innerWidth) {
        problems.push(`page scrolls sideways: scrollWidth ${scroller.scrollWidth} > innerWidth ${innerWidth}`);
    }

    // (c) text that is cut off by nowrap or overflow: hidden
    for (const el of document.querySelectorAll('p, a, button, h1, h2, h3, dd')) {
        if (!visible(el) || !(el.textContent ?? '').trim()) continue;
        const style = getComputedStyle(el);
        const clips = style.whiteSpace.startsWith('nowrap') || style.overflowX === 'hidden';
        if (clips && el.scrollWidth > el.clientWidth + 1) {
            problems.push(`clipped text (${el.scrollWidth} > ${el.clientWidth}): ${label(el)}`);
        }
    }

    // (d) a paragraph whose last own text node ends in a preposition is a cut sentence
    if (german) {
        for (const p of document.querySelectorAll('p')) {
            if (!visible(p)) continue;
            const last = [...p.childNodes].reverse().find((n) => n.nodeType !== Node.TEXT_NODE || (n.textContent ?? '').trim());
            if (last?.nodeType === Node.TEXT_NODE && /(^|\s)(an|zu|per|mit|für)$/i.test(last.textContent.trim())) {
                problems.push(`sentence ends in a preposition: ${label(p)}`);
            }
        }
    }

    // (e) the same button or link twice in one card (header, footer and nav may repeat)
    const groups = new Map();
    for (const el of document.querySelectorAll('a, button')) {
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!text || !visible(el) || el.closest('header, footer, nav, app-language-switcher')) continue;
        const card = el.closest('article, section, form, aside, dialog, [class*=card]');
        if (!card) continue;
        const texts = groups.get(card) ?? new Map();
        texts.set(text, (texts.get(text) ?? 0) + 1);
        groups.set(card, texts);
    }
    for (const [card, texts] of groups) {
        for (const [text, count] of texts) {
            if (count > 1) problems.push(`"${text}" appears ${count} times in ${label(card)}`);
        }
    }
    return problems;
}

/**
 * True when the viewer's canvas draws something: its region looks different with the canvas
 * hidden. Comparing against the page behind it keeps a transparent, empty canvas from passing.
 */
export async function canvasHasPixels(page) {
    const canvas = page.locator('canvas').first();
    await canvas.waitFor();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) return false;
    const withCanvas = await page.screenshot({ clip: box });
    await canvas.evaluate((el) => (el.style.visibility = 'hidden'));
    const without = await page.screenshot({ clip: box });
    await canvas.evaluate((el) => (el.style.visibility = ''));
    return !withCanvas.equals(without);
}
