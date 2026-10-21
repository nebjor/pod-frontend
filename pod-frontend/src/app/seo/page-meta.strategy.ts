import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const SITE_NAME = '3DBurg';
export const SITE_ORIGIN = 'https://3dburg.ch';
const DEFAULT_DESCRIPTION =
    'Modell hochladen, Preis sofort sehen, bestellen. 3D-Druck auf Bestellung aus Winterthur, Versand in der ganzen Schweiz.';

/** Per-route data the strategy reads; declared on the routes next to `title`. */
export interface PageMetaData {
    description?: string;
    /** Pages that must not appear in search results: cart, checkout, payment, admin. */
    noindex?: boolean;
}

/**
 * Sets what search engines and link previews read for every page: title, description,
 * canonical URL and the Open Graph tags, from the route's `title` and `data`. Runs on the
 * server too, so the prerendered HTML of each page already carries its own tags.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaStrategy extends TitleStrategy {
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);
    private readonly document = inject(DOCUMENT);

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const routeTitle = this.buildTitle(snapshot);
        const pageTitle = routeTitle ? `${routeTitle} – ${SITE_NAME}` : `${SITE_NAME} – 3D-Druck auf Bestellung`;
        const data = this.deepestData(snapshot);
        const description = data.description ?? DEFAULT_DESCRIPTION;
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
