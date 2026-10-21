import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
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
                    { path: 'checkout', component: BlankComponent, title: 'Bestellung', data: { noindex: true } }
                ]),
                { provide: TitleStrategy, useClass: PageMetaStrategy }
            ]
        }).compileComponents();
        router = TestBed.inject(Router);
        title = TestBed.inject(Title);
        meta = TestBed.inject(Meta);
    });

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

    it('keeps private pages out of search results', async () => {
        await router.navigateByUrl('/checkout');

        expect(tag('name="robots"')).toBe('noindex, nofollow');
    });
});
