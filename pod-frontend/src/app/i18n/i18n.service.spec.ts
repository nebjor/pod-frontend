import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationKey } from './de';
import { I18nService, LANG_STORAGE_KEY, loadDictionary, translate } from './i18n.service';

describe('I18nService', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.lang = 'de';
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('starts in German whatever the browser language is', () => {
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-CH');

        const service = TestBed.inject(I18nService);

        expect(service.lang()).toBe('de');
        expect(service.t('cart.empty')).toBe('Dein Warenkorb ist leer.');
    });

    it('persists a choice to localStorage and to the document language', async () => {
        const service = TestBed.inject(I18nService);

        await service.setLang('fr');
        TestBed.tick();

        expect(service.lang()).toBe('fr');
        expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('fr');
        expect(document.documentElement.lang).toBe('fr');
        expect(service.t('cart.empty')).toBe('Votre panier est vide.');
    });

    it('switches to German at once, without waiting for anything', async () => {
        const service = TestBed.inject(I18nService);
        await service.setLang('en');

        void service.setLang('de');

        expect(service.lang()).toBe('de');
        expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('de');
    });

    it('applies the saved choice after the first render, not while the service is created', async () => {
        localStorage.setItem(LANG_STORAGE_KEY, 'it');

        const service = TestBed.inject(I18nService);
        expect(service.lang()).toBe('de');

        const app = TestBed.inject(ApplicationRef);
        app.tick();
        await app.whenStable();

        expect(service.lang()).toBe('it');
    });

    it('ignores a saved value that is not a language', async () => {
        localStorage.setItem(LANG_STORAGE_KEY, 'klingon');

        const service = TestBed.inject(I18nService);
        const app = TestBed.inject(ApplicationRef);
        app.tick();
        await app.whenStable();

        expect(service.lang()).toBe('de');
    });

    it('keeps working when the storage throws', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        const service = TestBed.inject(I18nService);
        const app = TestBed.inject(ApplicationRef);
        app.tick();
        await service.setLang('en');

        expect(service.lang()).toBe('en');
    });

    it('lets the last choice win when two switches overlap', async () => {
        const service = TestBed.inject(I18nService);

        const first = service.setLang('fr');
        const second = service.setLang('de');
        await Promise.all([first, second]);

        expect(service.lang()).toBe('de');
        expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('de');
    });

    it('fills {name} placeholders and leaves unknown ones in place', () => {
        const service = TestBed.inject(I18nService);

        expect(service.t('common.pieces', { count: 3 })).toBe('3 Stück');
        expect(service.t('checkout.priceValid', { date: '01.02.2027' })).toBe('Der Preis ist bis 01.02.2027 gültig.');
        expect(service.t('common.pieces')).toBe('{count} Stück');
        expect(service.t('common.pieces', { other: 1 })).toBe('{count} Stück');
        expect(service.t('common.pieces', { count: null })).toBe(' Stück');
    });

    it('falls back to the key itself when no dictionary has it', async () => {
        const service = TestBed.inject(I18nService);
        await loadDictionary('en');

        expect(service.t('no.such.key' as TranslationKey)).toBe('no.such.key');
        expect(translate('en', 'no.such.key' as TranslationKey, { a: 1 })).toBe('no.such.key');
    });

    it('answers in the language chosen last', async () => {
        const service = TestBed.inject(I18nService);

        await service.setLang('en');
        expect(service.t('common.toCart')).toBe('Go to cart');
        await service.setLang('it');
        expect(service.t('common.toCart')).toBe('Vai al carrello');
    });
});
