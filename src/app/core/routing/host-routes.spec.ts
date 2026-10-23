import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ROUTES, Routes } from '@angular/router';
import { isAdminHost, provideHostRoutes } from './host-routes';

// Stub tables: this spec checks which table the host selects, not what the app's tables hold
// (see app.routes.spec.ts). Core must not import the feature layer.
const shopRoutes: Routes = [{ path: '' }, { path: 'upload' }, { path: 'admin' }];
const adminRoutes: Routes = [{ path: '' }];

describe('host routes', () => {
    it('recognises the admin host and nothing else', () => {
        expect(isAdminHost('admin.3dburg.ch')).toBe(true);
        expect(isAdminHost('admin.localhost')).toBe(true);
        expect(isAdminHost('ADMIN.3dburg.ch')).toBe(true);
        expect(isAdminHost('3dburg.ch')).toBe(false);
        expect(isAdminHost('www.3dburg.ch')).toBe(false);
        expect(isAdminHost('shop.admin.example')).toBe(false);
        expect(isAdminHost(null)).toBe(false);
        expect(isAdminHost(undefined)).toBe(false);
    });

    it('serves the shop routes in the browser on the shop host', () => {
        TestBed.configureTestingModule({ providers: [provideHostRoutes({ shop: shopRoutes, admin: adminRoutes })] });
        const [routes] = TestBed.inject(ROUTES) as Routes[];
        expect(routes).toBe(shopRoutes);
    });

    it('falls back to the shop routes while prerendering, where no host is known', () => {
        TestBed.configureTestingModule({ providers: [provideHostRoutes({ shop: shopRoutes, admin: adminRoutes }), { provide: PLATFORM_ID, useValue: 'server' }] });
        const [routes] = TestBed.inject(ROUTES) as Routes[];
        expect(routes).toBe(shopRoutes);
    });
});
