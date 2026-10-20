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
        path: 'checkout/success',
        loadComponent: () => import('./checkout/order-success.component').then((m) => m.OrderSuccessComponent)
    },
    {
        path: 'checkout',
        loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent)
    },
    {
        path: 'pay/mock',
        loadComponent: () => import('./payment/mock-payment.component').then((m) => m.MockPaymentComponent)
    },
    {
        path: 'admin',
        loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent)
    },
    {
        path: 'impressum',
        loadComponent: () => import('./legal/imprint.component').then((m) => m.ImprintComponent)
    },
    {
        path: 'agb',
        loadComponent: () => import('./legal/terms.component').then((m) => m.TermsComponent)
    },
    {
        path: 'datenschutz',
        loadComponent: () => import('./legal/privacy.component').then((m) => m.PrivacyComponent)
    },
    { path: '**', redirectTo: '' }
];
