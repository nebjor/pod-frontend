import { Routes } from '@angular/router';

const admin = () => import('./admin/admin.component').then((m) => m.AdminComponent);

/**
 * Page titles and descriptions are dictionary keys in `data` (`titleKey`, `descriptionKey`), not
 * `title` strings: PageMetaStrategy resolves them in the active language, also after a switch.
 * Every page is lazy loaded so the 3D viewer (three.js) only ships with the pages that
 * render it and stays out of the initial bundle. Which table applies is decided by the host
 * (see host-routes.ts): the shop's pages on the shop host, the admin panel on the admin host.
 */
export const shopRoutes: Routes = [
    {
        path: '',
        data: { titleKey: 'meta.home.title', descriptionKey: 'meta.home.description' },
        loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent)
    },
    {
        path: 'upload',
        data: { titleKey: 'meta.upload.title', descriptionKey: 'meta.upload.description' },
        loadComponent: () => import('./upload/upload.component').then((m) => m.UploadComponent)
    },
    {
        path: 'warenkorb',
        data: { titleKey: 'meta.cart.title', noindex: true },
        loadComponent: () => import('./cart/cart.component').then((m) => m.CartComponent)
    },
    {
        path: 'checkout/success',
        data: { titleKey: 'meta.checkout.title', noindex: true },
        loadComponent: () => import('./checkout/order-success.component').then((m) => m.OrderSuccessComponent)
    },
    {
        path: 'checkout',
        data: { titleKey: 'meta.checkout.title', noindex: true },
        loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent)
    },
    {
        path: 'pay/mock',
        data: { titleKey: 'meta.payment.title', noindex: true },
        loadComponent: () => import('./payment/mock-payment.component').then((m) => m.MockPaymentComponent)
    },
    {
        path: 'bestellung',
        data: { titleKey: 'meta.order.title' },
        loadComponent: () => import('./order/order-status.component').then((m) => m.OrderStatusComponent)
    },
    {
        path: 'konto/anmelden',
        data: { titleKey: 'meta.login.title', noindex: true },
        loadComponent: () => import('./account/login.component').then((m) => m.LoginComponent)
    },
    {
        path: 'konto',
        data: { noindex: true },
        loadComponent: () => import('./account/account-shell.component').then((m) => m.AccountShellComponent),
        children: [
            {
                path: '',
                pathMatch: 'full',
                data: { titleKey: 'meta.orders.title', noindex: true },
                loadComponent: () => import('./account/account.component').then((m) => m.AccountComponent)
            },
            {
                path: 'adresse',
                data: { titleKey: 'meta.address.title', noindex: true },
                loadComponent: () => import('./account/address.component').then((m) => m.AddressComponent)
            },
            {
                path: 'passwort',
                data: { titleKey: 'meta.password.title', noindex: true },
                loadComponent: () => import('./account/password.component').then((m) => m.PasswordComponent)
            }
        ]
    },
    {
        // Kept in the shop table so the page is prerendered; on the shop host Caddy redirects
        // it to the admin host, where it is served as the root (see server.ts).
        path: 'admin',
        title: 'Admin',
        data: { noindex: true },
        loadComponent: admin
    },
    {
        path: 'ueber-uns',
        data: { titleKey: 'meta.about.title', descriptionKey: 'meta.about.description' },
        loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent)
    },
    {
        path: 'impressum',
        data: { titleKey: 'meta.imprint.title' },
        loadComponent: () => import('./legal/imprint.component').then((m) => m.ImprintComponent)
    },
    {
        path: 'agb',
        data: { titleKey: 'meta.terms.title', descriptionKey: 'meta.terms.description' },
        loadComponent: () => import('./legal/terms.component').then((m) => m.TermsComponent)
    },
    {
        path: 'datenschutz',
        data: { titleKey: 'meta.privacy.title', descriptionKey: 'meta.privacy.description' },
        loadComponent: () => import('./legal/privacy.component').then((m) => m.PrivacyComponent)
    },
    { path: '**', redirectTo: '' }
];

/**
 * On admin.3dburg.ch the panel is the root. The 'admin' path stays as well because the
 * prerendered page the server hands out for the root of that host is the one built for
 * /admin (see server.ts); both paths render the same component, so hydration matches.
 */
export const adminRoutes: Routes = [
    { path: '', title: 'Admin', data: { noindex: true }, loadComponent: admin },
    { path: 'admin', title: 'Admin', data: { noindex: true }, loadComponent: admin },
    { path: '**', redirectTo: '' }
];

/** Default table, used by tooling that needs one without a host. */
export const routes = shopRoutes;
