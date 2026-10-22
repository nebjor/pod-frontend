import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AboutComponent } from '../about/about.component';
import { FooterComponent } from '../footer/footer.component';
import { I18nService } from './i18n.service';

describe('translated pages follow the language switch', () => {
    afterEach(() => localStorage.clear());

    it('footer: labels, links stay the same, product and business data stay as they are', async () => {
        await TestBed.configureTestingModule({ imports: [FooterComponent], providers: [provideRouter([])] }).compileComponents();
        const fixture = TestBed.createComponent(FooterComponent);
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;

        expect(root.textContent).toContain('Gedruckt und versendet in der Schweiz');

        await TestBed.inject(I18nService).setLang('it');
        await fixture.whenStable();

        expect(root.textContent).toContain('Stampato e spedito in Svizzera');
        expect(root.textContent).toContain('Stampa 3D su ordinazione da Winterthur.');
        expect(root.textContent).not.toContain('Gedruckt und versendet');
        expect(root.querySelector('a[href="/impressum"]')?.textContent?.trim()).toBe('Note legali');
        expect(root.querySelector('a[href="/agb"]')?.textContent?.trim()).toBe('CGC');
    });

    it('about page: texts and the logo description switch, the address stays', async () => {
        await TestBed.configureTestingModule({ imports: [AboutComponent], providers: [provideRouter([])] }).compileComponents();
        const fixture = TestBed.createComponent(AboutComponent);
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;

        await TestBed.inject(I18nService).setLang('en');
        await fixture.whenStable();

        expect(root.querySelector('h1')?.textContent?.trim()).toBe('3D printing from Winterthur');
        expect(root.querySelector('img[src="/zhaw-logo.png"]')?.getAttribute('alt')).toBe('ZHAW Zurich University of Applied Sciences');
        expect(root.textContent).toContain('Bambu Lab A1');
        expect(root.querySelector('a[href="mailto:info@3dburg.ch"]')).not.toBeNull();
    });
});
