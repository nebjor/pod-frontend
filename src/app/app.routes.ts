import { RedirectFunction, Routes } from '@angular/router';
import { ORDERS_PATH, orderPath } from '@core/account/account.models';

/** `/bestellung?nr=X` (an old order mail) opens that order; without a number the order list. */
export const legacyOrderLinkRedirect: RedirectFunction = (route) => {
    const raw: unknown = route.queryParams['nr'];
    const orderNumber = Array.isArray(raw) ? raw[0] : raw;
    return typeof orderNumber === 'string' && orderNumber ? orderPath(orderNumber) : ORDERS_PATH;
};

const admin = () => import('@features/admin/admin-page.component').then((m) => m.AdminPageComponent);

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
        loadComponent: () => import('@features/landing/landing-page.component').then((m) => m.LandingPageComponent)
    },
    {
        path: 'upload',
        data: { titleKey: 'meta.upload.title', descriptionKey: 'meta.upload.description' },
        loadComponent: () => import('@features/upload/upload-page.component').then((m) => m.UploadPageComponent)
    },
    {
        path: 'warenkorb',
        data: { titleKey: 'meta.cart.title', noindex: true },
        loadComponent: () => import('@features/cart/cart-page.component').then((m) => m.CartPageComponent)
    },
    {
        path: 'checkout/success',
        data: { titleKey: 'meta.checkout.title', noindex: true },
        loadComponent: () => import('@features/checkout/order-success-page.component').then((m) => m.OrderSuccessPageComponent)
    },
    {
        path: 'checkout',
        data: { titleKey: 'meta.checkout.title', noindex: true },
        loadComponent: () => import('@features/checkout/checkout-page.component').then((m) => m.CheckoutPageComponent)
    },
    {
        path: 'pay/mock',
        data: { titleKey: 'meta.payment.title', noindex: true },
        loadComponent: () => import('@features/payment/mock-payment-page.component').then((m) => m.MockPaymentPageComponent)
    },
    {
        // The public lookup is gone (ADR 0011); old mail links land on the account's orders.
        path: 'bestellung',
        pathMatch: 'full',
        redirectTo: legacyOrderLinkRedirect
    },
    {
        path: 'konto/anmelden',
        data: { titleKey: 'meta.login.title', noindex: true },
        loadComponent: () => import('@features/account/login-page.component').then((m) => m.LoginPageComponent)
    },
    {
        path: 'konto',
        data: { noindex: true },
        loadComponent: () => import('@features/account/account-shell.component').then((m) => m.AccountShellComponent),
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'bestellungen' },
            {
                path: 'bestellungen',
                pathMatch: 'full',
                data: { titleKey: 'meta.orders.title', noindex: true },
                loadComponent: () => import('@features/account/orders-page.component').then((m) => m.OrdersPageComponent)
            },
            {
                path: 'bestellungen/:orderNumber',
                data: { titleKey: 'meta.orderDetail.title', noindex: true },
                loadComponent: () =>
                    import('@features/account/order-detail-page.component').then((m) => m.OrderDetailPageComponent)
            },
            {
                path: 'adresse',
                data: { titleKey: 'meta.address.title', noindex: true },
                loadComponent: () => import('@features/account/address-page.component').then((m) => m.AddressPageComponent)
            },
            {
                path: 'passwort',
                data: { titleKey: 'meta.password.title', noindex: true },
                loadComponent: () => import('@features/account/password-page.component').then((m) => m.PasswordPageComponent)
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
        loadComponent: () => import('@features/about/about-page.component').then((m) => m.AboutPageComponent)
    },
    {
        path: 'impressum',
        data: { titleKey: 'meta.imprint.title' },
        loadComponent: () => import('@features/legal/imprint-page.component').then((m) => m.ImprintPageComponent)
    },
    {
        path: 'agb',
        data: { titleKey: 'meta.terms.title', descriptionKey: 'meta.terms.description' },
        loadComponent: () => import('@features/legal/terms-page.component').then((m) => m.TermsPageComponent)
    },
    {
        path: 'datenschutz',
        data: { titleKey: 'meta.privacy.title', descriptionKey: 'meta.privacy.description' },
        loadComponent: () => import('@features/legal/privacy-page.component').then((m) => m.PrivacyPageComponent)
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
