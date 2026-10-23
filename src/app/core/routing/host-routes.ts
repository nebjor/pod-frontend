import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Provider, inject } from '@angular/core';
import { ROUTES, Routes } from '@angular/router';

/**
 * The admin panel is served on its own host (admin.3dburg.ch) so that the owner's session
 * never shares an origin with the shop. Same bundle, different route table: on an admin host
 * the root is the admin panel and the shop's pages do not exist; elsewhere the shop's routes
 * apply and the admin is not reachable.
 */
export function isAdminHost(hostname: string | null | undefined): boolean {
    return !!hostname && /^admin\./i.test(hostname);
}

/** Picks the route table for the host the app runs on; prerendering (no host) renders the shop. */
export function provideHostRoutes(tables: { shop: Routes; admin: Routes }): Provider {
    return {
        provide: ROUTES,
        multi: true,
        useFactory: () => {
            const platformId = inject(PLATFORM_ID);
            const hostname = isPlatformBrowser(platformId) ? window.location.hostname : null;
            return isAdminHost(hostname) ? tables.admin : tables.shop;
        }
    };
}
