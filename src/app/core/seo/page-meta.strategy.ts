import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslationKey } from '../i18n/de';
import { I18nService } from '../i18n/i18n.service';

export const SITE_NAME = '3DBurg';
export const SITE_ORIGIN = 'https://3dburg.ch';
/** Per-route data the strategy reads; declared on the routes next to `title`. */
export interface PageMetaData {
    /** Dictionary key of the page title, resolved in the active language. */
    titleKey?: TranslationKey;
    /** Literal description, for routes outside the translated shop (and the tests). */
    description?: string;
    /** Dictionary key of the description, resolved in the active language. */
    descriptionKey?: TranslationKey;
    /** Pages that must not appear in search results: cart, checkout, payment, admin. */
    noindex?: boolean;
}

/**
 * Sets what search engines and link previews read for every page: title, description,
 * canonical URL and the Open Graph tags, from the route's `title` and `data`. Runs on the
 * server too, so the prerendered HTML of each page already carries its own tags. Titles and
 * descriptions are looked up by key and written again when the language changes; the server
 * and the prerender always write German.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaStrategy extends TitleStrategy {
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);
    private readonly document = inject(DOCUMENT);
    private readonly i18n = inject(I18nService);
    private current: RouterStateSnapshot | null = null;

    constructor() {
        super();
        effect(() => {
            this.i18n.lang();
            const snapshot = this.current;
            if (snapshot) {
                untracked(() => this.write(snapshot));
            }
        });
    }

    override updateTitle(snapshot: RouterStateSnapshot): void {
        this.current = snapshot;
        this.write(snapshot);
    }

    private write(snapshot: RouterStateSnapshot) {
        const data = this.deepestData(snapshot);
        const routeTitle = data.titleKey ? this.i18n.t(data.titleKey) : this.buildTitle(snapshot);
        const pageTitle = routeTitle
            ? `${routeTitle} – ${SITE_NAME}`
            : `${SITE_NAME} – ${this.i18n.t('meta.defaultTitle')}`;
        const description = data.descriptionKey
            ? this.i18n.t(data.descriptionKey)
            : (data.description ?? this.i18n.t('meta.defaultDescription'));
        const path = snapshot.url.split('?')[0];
        const canonical = SITE_ORIGIN + (path === '/' ? '/' : path.replace(/\/$/, ''));

        this.title.setTitle(pageTitle);
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ name: 'robots', content: data.noindex ? 'noindex, nofollow' : 'index, follow' });
        this.meta.updateTag({ property: 'og:title', content: pageTitle });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'og:url', content: canonical });
        this.setCanonical(canonical);
    }

    private deepestData(snapshot: RouterStateSnapshot): PageMetaData {
        let route = snapshot.root;
        let data: PageMetaData = {};
        while (route) {
            data = { ...data, ...(route.data as PageMetaData) };
            if (!route.firstChild) {
                break;
            }
            route = route.firstChild;
        }
        return data;
    }

    private setCanonical(href: string) {
        let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = this.document.createElement('link');
            link.setAttribute('rel', 'canonical');
            this.document.head.appendChild(link);
        }
        link.setAttribute('href', href);
    }
}
