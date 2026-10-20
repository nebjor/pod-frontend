import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ROUTES, Routes } from '@angular/router';
import { adminRoutes, shopRoutes } from './app.routes';
import { isAdminHost, provideHostRoutes } from './host-routes';

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
        TestBed.configureTestingModule({ providers: [provideHostRoutes()] });
        const [routes] = TestBed.inject(ROUTES) as Routes[];
        expect(routes).toBe(shopRoutes);
    });

    it('falls back to the shop routes while prerendering, where no host is known', () => {
        TestBed.configureTestingModule({ providers: [provideHostRoutes(), { provide: PLATFORM_ID, useValue: 'server' }] });
        const [routes] = TestBed.inject(ROUTES) as Routes[];
        expect(routes).toBe(shopRoutes);
    });

    it('serves the panel at the root of the admin table and keeps the shop out of it', () => {
        expect(adminRoutes.find((route) => route.path === '')?.loadComponent).toBeDefined();
        expect(adminRoutes.map((route) => route.path)).not.toContain('upload');
        // Still in the shop table so it is prerendered; the shop host redirects it to the admin host.
        expect(shopRoutes.map((route) => route.path)).toContain('admin');
    });
});
