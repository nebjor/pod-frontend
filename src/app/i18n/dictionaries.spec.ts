import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { it as italian } from './it';

const dictionaries = { de, fr, it: italian, en } as const;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('dictionaries', () => {
    const germanKeys = Object.keys(de).sort();

    for (const [lang, dictionary] of Object.entries(dictionaries)) {
        describe(lang, () => {
            it('has exactly the keys of the German dictionary', () => {
                expect(Object.keys(dictionary).sort()).toEqual(germanKeys);
            });

            it('has no empty strings', () => {
                const empty = Object.entries(dictionary).filter(([, text]) => text.trim() === '');
                expect(empty).toEqual([]);
            });

            it('uses the same {placeholders} as the German text for every key', () => {
                const mismatches = Object.entries(dictionary as Record<string, string>)
                    .filter(([key, text]) => placeholders(text).join() !== placeholders((de as Record<string, string>)[key]).join())
                    .map(([key]) => key);
                expect(mismatches).toEqual([]);
            });
        });
    }

    it('translates every text: no non-German dictionary repeats a German sentence', () => {
        // Product names, codes and one-word terms that are the same in every language are fine.
        const sentence = (text: string) => text.trim().split(/\s+/).length >= 4;
        for (const [lang, dictionary] of Object.entries({ fr, it: italian, en })) {
            const untranslated = Object.entries(dictionary as Record<string, string>)
                .filter(([key, text]) => sentence(text) && text === (de as Record<string, string>)[key])
                .map(([key]) => key);
            expect(untranslated, lang).toEqual([]);
        }
    });

    it('keeps the German texts free of the sharp s', () => {
        expect(Object.values(de).filter((text) => text.includes('ß'))).toEqual([]);
    });
});
