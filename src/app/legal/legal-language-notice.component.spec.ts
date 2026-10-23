import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nService } from '../i18n/i18n.service';
import { ImprintComponent } from './imprint.component';
import { PrivacyComponent } from './privacy.component';
import { TermsComponent } from './terms.component';

describe('legal pages language notice', () => {
    afterEach(() => localStorage.clear());

    for (const [name, component] of [
        ['Impressum', ImprintComponent],
        ['AGB', TermsComponent],
        ['Datenschutz', PrivacyComponent]
    ] as const) {
        it(`${name}: shows no notice in German and one translated line otherwise`, async () => {
            await TestBed.configureTestingModule({ imports: [component], providers: [provideRouter([])] }).compileComponents();
            const fixture = TestBed.createComponent(component);
            await fixture.whenStable();
            const root = fixture.nativeElement as HTMLElement;
            const i18n = TestBed.inject(I18nService);

            expect(root.querySelector('.language-notice')).toBeNull();

            await i18n.setLang('fr');
            await fixture.whenStable();
            expect(root.querySelector('.language-notice')?.textContent?.trim()).toBe(
                'Les textes juridiques font foi dans leur version allemande.'
            );

            await i18n.setLang('it');
            await fixture.whenStable();
            expect(root.querySelector('.language-notice')?.textContent?.trim()).toBe(
                'I testi legali fanno fede nella versione tedesca.'
            );

            await i18n.setLang('en');
            await fixture.whenStable();
            expect(root.querySelector('.language-notice')?.textContent?.trim()).toBe(
                'The German version of the legal texts is binding.'
            );

            // The legal text itself stays German.
            expect(root.textContent).toContain('Rechtliches');

            await i18n.setLang('de');
            await fixture.whenStable();
            expect(root.querySelector('.language-notice')).toBeNull();
        });
    }
});
