import { DOCUMENT } from '@angular/common';
import { Injectable, PendingTasks, afterNextRender, effect, inject, signal } from '@angular/core';
import { TranslationKey, de } from './de';

export type Lang = 'de' | 'fr' | 'it' | 'en';

/** In the order the language switcher lists them. */
export const LANGS: ReadonlyArray<Lang> = ['de', 'fr', 'it', 'en'];

/** German by decision: there is no detection from the browser's language. */
export const DEFAULT_LANG: Lang = 'de';

export const LANG_STORAGE_KEY = 'pod.lang';

/** Values of the `{name}` placeholders; the number and date pipes may return null, which fills in nothing. */
export type TranslateParams = Record<string, string | number | null | undefined>;

/** What helpers outside the injection tree receive to word their messages. */
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

type Dictionary = Readonly<Record<TranslationKey, string>>;

/**
 * German is part of the main bundle: it is what the server renders and the fallback for
 * everything else. The other dictionaries are separate chunks, fetched when a visitor first
 * switches to them, so they cost nobody who stays on German anything.
 */
const loaders: Record<Exclude<Lang, 'de'>, () => Promise<Dictionary>> = {
    fr: () => import('./fr').then((module) => module.fr),
    it: () => import('./it').then((module) => module.it),
    en: () => import('./en').then((module) => module.en)
};

const loaded: Partial<Record<Lang, Dictionary>> = { de };

export function isLang(value: unknown): value is Lang {
    return typeof value === 'string' && (LANGS as ReadonlyArray<string>).includes(value);
}

/** Fetches the dictionary of a language unless it is there already. */
export function loadDictionary(lang: Lang): Promise<void> {
    if (lang === 'de' || loaded[lang]) {
        return Promise.resolve();
    }
    return loaders[lang]().then((dictionary) => {
        loaded[lang] = dictionary;
    });
}

/**
 * Looks a key up in one dictionary and fills the `{name}` placeholders. A key that no
 * dictionary knows comes back as itself, so a typo shows up on the page instead of as a blank.
 * A language whose dictionary has not been loaded yet is answered in German.
 */
export function translate(lang: Lang, key: TranslationKey, params?: TranslateParams): string {
    const template: string | undefined = (loaded[lang] ?? de)[key];
    if (template === undefined) {
        return key;
    }
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        name in params ? String(params[name] ?? '') : placeholder
    );
}

/** German wording for helpers that are called without a service (admin area, plain functions). */
export const translateDe: Translate = (key, params) => translate('de', key, params);

/**
 * The active language of the customer-facing shop. The server and the prerender always render
 * German; in the browser the saved choice is applied after the first render, so hydration
 * still matches the German markup. Components read {@link lang} (directly, through the `t`
 * pipe or through {@link t}) and re-render when it changes.
 *
 * A language becomes active only once its dictionary is loaded, so the page never shows keys
 * or a half-translated state while the chunk is on its way.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
    private readonly document = inject(DOCUMENT);
    private readonly pendingTasks = inject(PendingTasks);
    private readonly langState = signal<Lang>(DEFAULT_LANG);
    /** The language asked for last; an older switch that finishes later does not overrule it. */
    private requested: Lang = DEFAULT_LANG;

    readonly lang = this.langState.asReadonly();

    constructor() {
        afterNextRender(() => {
            const saved = this.readSaved();
            if (saved && saved !== DEFAULT_LANG) {
                void this.setLang(saved);
            }
        });
        effect(() => {
            this.document.documentElement.lang = this.langState();
        });
    }

    /** Resolves a key in the active language; bound so it can be handed around as a function. */
    readonly t: Translate = (key, params) => translate(this.langState(), key, params);

    /**
     * Switches the language and remembers the choice. Resolves once it is active; for German
     * and for a language already loaded that is immediately. If the dictionary cannot be
     * fetched (offline) the current language stays.
     */
    async setLang(lang: Lang): Promise<void> {
        this.requested = lang;
        if (lang !== DEFAULT_LANG && !loaded[lang]) {
            const done = this.pendingTasks.add();
            try {
                await loadDictionary(lang);
            } catch {
                return;
            } finally {
                done();
            }
        }
        if (this.requested !== lang) {
            return;
        }
        this.langState.set(lang);
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {
            // Storage can be unavailable (private mode); the choice then lasts for this visit.
        }
    }

    private readSaved(): Lang | null {
        try {
            const saved = localStorage.getItem(LANG_STORAGE_KEY);
            return isLang(saved) ? saved : null;
        } catch {
            return null;
        }
    }
}
