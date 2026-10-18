import { Routes } from '@angular/router';

/**
 * Every page is lazy loaded so the 3D viewer (three.js) only ships with the pages that
 * render it and stays out of the initial bundle.
 */
export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent)
    },
    {
        path: 'upload',
        loadComponent: () => import('./upload/upload.component').then((m) => m.UploadComponent)
    },
    {
        path: 'checkout',
        loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent)
    },
    { path: '**', redirectTo: '' }
];
