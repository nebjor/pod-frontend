import { describe, expect, it } from 'vitest';
import { adminRoutes, legacyOrderLinkRedirect, shopRoutes } from './app.routes';

describe('route tables', () => {
    it('serves the panel at the root of the admin table and keeps the shop out of it', () => {
        expect(adminRoutes.find((route) => route.path === '')?.loadComponent).toBeDefined();
        expect(adminRoutes.map((route) => route.path)).not.toContain('upload');
        // Still in the shop table so it is prerendered; the shop host redirects it to the admin host.
        expect(shopRoutes.map((route) => route.path)).toContain('admin');
    });

    it('has no public order lookup page any more', () => {
        const old = shopRoutes.find((route) => route.path === 'bestellung');
        expect(old?.loadComponent).toBeUndefined();
        expect(old?.redirectTo).toBe(legacyOrderLinkRedirect);
    });

    it('sends an old order mail link to that order, or to the order list without a number', () => {
        const redirect = (queryParams: Record<string, string>) =>
            (legacyOrderLinkRedirect as (route: { queryParams: Record<string, string> }) => string)({ queryParams });

        expect(redirect({ nr: 'POD-1001', email: 'anna@example.com' })).toBe('/konto/bestellungen/POD-1001');
        expect(redirect({})).toBe('/konto/bestellungen');
        expect(redirect({ nr: ['POD-1002', 'POD-9'] as unknown as string })).toBe('/konto/bestellungen/POD-1002');
    });

    it('keeps the order list, one order, the address and the password inside the account shell', () => {
        const account = shopRoutes.find((route) => route.path === 'konto');
        const paths = account?.children?.map((route) => route.path);

        expect(paths).toEqual(['', 'bestellungen', 'bestellungen/:orderNumber', 'adresse', 'passwort']);
        expect(account?.children?.[0].redirectTo).toBe('bestellungen');
        expect(shopRoutes.map((route) => route.path)).toContain('konto/anmelden');
    });
});
