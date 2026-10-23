import { describe, expect, it } from 'vitest';
import { adminRoutes, shopRoutes } from './app.routes';

describe('route tables', () => {
    it('serves the panel at the root of the admin table and keeps the shop out of it', () => {
        expect(adminRoutes.find((route) => route.path === '')?.loadComponent).toBeDefined();
        expect(adminRoutes.map((route) => route.path)).not.toContain('upload');
        // Still in the shop table so it is prerendered; the shop host redirects it to the admin host.
        expect(shopRoutes.map((route) => route.path)).toContain('admin');
    });
});
