import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { PageMetaStrategy } from './page-meta.strategy';

@Component({ template: '' })
class BlankComponent {}

describe('PageMetaStrategy', () => {
    let router: Router;
    let title: Title;
    let meta: Meta;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            providers: [
                provideRouter([
                    { path: '', component: BlankComponent, title: 'Start', data: { description: 'Startseite' } },
                    { path: 'upload', component: BlankComponent, title: 'Modell hochladen' },
                    { path: 'checkout', component: BlankComponent, title: 'Bestellung', data: { noindex: true } },
                    {
                        path: 'ueber',
                        component: BlankComponent,
                        data: { titleKey: 'meta.about.title', descriptionKey: 'meta.about.description' }
                    },
                    { path: 'ohne', component: BlankComponent }
                ]),
                { provide: TitleStrategy, useClass: PageMetaStrategy }
            ]
        }).compileComponents();
        router = TestBed.inject(Router);
        title = TestBed.inject(Title);
        meta = TestBed.inject(Meta);
    });

    afterEach(() => localStorage.clear());

    function tag(selector: string): string | null {
        return meta.getTag(selector)?.getAttribute('content') ?? null;
    }

    it('writes title, description, canonical and Open Graph tags for a page', async () => {
        await router.navigateByUrl('/upload');

        expect(title.getTitle()).toBe('Modell hochladen – 3DBurg');
        expect(tag('property="og:title"')).toBe('Modell hochladen – 3DBurg');
        expect(tag('property="og:url"')).toBe('https://3dburg.ch/upload');
        expect(tag('name="robots"')).toBe('index, follow');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://3dburg.ch/upload');
        // No description on the route: the site default applies.
        expect(tag('name="description"')).toContain('Winterthur');
    });

    it('uses the route description and the root canonical on the start page', async () => {
        await router.navigateByUrl('/');

        expect(title.getTitle()).toBe('Start – 3DBurg');
        expect(tag('name="description"')).toBe('Startseite');
        expect(tag('property="og:url"')).toBe('https://3dburg.ch/');
    });

    it('resolves title and description from their keys, German by default', async () => {
        await router.navigateByUrl('/ueber');

        expect(title.getTitle()).toBe('Über uns – 3DBurg');
        expect(tag('name="description"')).toContain('ZHAW');
        expect(tag('property="og:title"')).toBe('Über uns – 3DBurg');
    });

    it('writes the tags again in the new language when it is switched', async () => {
        await router.navigateByUrl('/ueber');

        await TestBed.inject(I18nService).setLang('fr');
        TestBed.tick();

        expect(title.getTitle()).toBe('À propos – 3DBurg');
        expect(tag('name="description"')).toContain('Winterthour');
        expect(tag('property="og:title"')).toBe('À propos – 3DBurg');
    });

    it('translates the site default for a route without a title', async () => {
        await router.navigateByUrl('/ohne');
        expect(title.getTitle()).toBe('3DBurg – 3D-Druck auf Bestellung');

        await TestBed.inject(I18nService).setLang('en');
        TestBed.tick();

        expect(title.getTitle()).toBe('3DBurg – Made-to-order 3D printing');
        expect(tag('name="description"')).toContain('Made-to-order');
    });

    it('keeps private pages out of search results', async () => {
        await router.navigateByUrl('/checkout');

        expect(tag('name="robots"')).toBe('noindex, nofollow');
    });
});
