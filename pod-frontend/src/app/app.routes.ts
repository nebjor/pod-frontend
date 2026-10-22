import { Routes } from '@angular/router';

const admin = () => import('./admin/admin.component').then((m) => m.AdminComponent);

/**
 * Every page is lazy loaded so the 3D viewer (three.js) only ships with the pages that
 * render it and stays out of the initial bundle. Which table applies is decided by the host
 * (see host-routes.ts): the shop's pages on the shop host, the admin panel on the admin host.
 */
export const shopRoutes: Routes = [
    {
        path: '',
        title: '3D-Druck auf Bestellung aus Winterthur',
        data: { description: 'Modell hochladen, Preis sofort sehen, bestellen. 3D-Druck in PLA, PETG und PCTG aus Winterthur, Versand in der ganzen Schweiz.' },
        loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent)
    },
    {
        path: 'upload',
        title: 'Modell hochladen und Sofortpreis',
        data: { description: 'STL oder 3MF hochladen, Material, Farbe und Qualitaet waehlen und den Preis aus einem echten Slicer-Durchlauf sofort sehen.' },
        loadComponent: () => import('./upload/upload.component').then((m) => m.UploadComponent)
    },
    {
        path: 'warenkorb',
        title: 'Warenkorb',
        data: { noindex: true },
        loadComponent: () => import('./cart/cart.component').then((m) => m.CartComponent)
    },
    {
        path: 'checkout/success',
        title: 'Bestellung',
        data: { noindex: true },
        loadComponent: () => import('./checkout/order-success.component').then((m) => m.OrderSuccessComponent)
    },
    {
        path: 'checkout',
        title: 'Bestellung',
        data: { noindex: true },
        loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent)
    },
    {
        path: 'pay/mock',
        title: 'Zahlung',
        data: { noindex: true },
        loadComponent: () => import('./payment/mock-payment.component').then((m) => m.MockPaymentComponent)
    },
    {
        path: 'bestellung',
        title: 'Meine Bestellung | 3DBurg',
        loadComponent: () => import('./order/order-status.component').then((m) => m.OrderStatusComponent)
    },
    {
        path: 'konto/anmelden',
        title: 'Anmelden | 3DBurg',
        data: { noindex: true },
        loadComponent: () => import('./account/login.component').then((m) => m.LoginComponent)
    },
    {
        path: 'konto/passwort',
        title: 'Passwort | 3DBurg',
        data: { noindex: true },
        loadComponent: () => import('./account/password.component').then((m) => m.PasswordComponent)
    },
    {
        path: 'konto',
        title: 'Mein Konto | 3DBurg',
        data: { noindex: true },
        loadComponent: () => import('./account/account.component').then((m) => m.AccountComponent)
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
        title: 'Über uns | 3DBurg',
        data: { description: '3D-Druck in der Schweiz: in Winterthur gedruckt, von Studenten der ZHAW lanciert. Sofortpreis aus dem Slicer, Festpreis, Versand in die ganze Schweiz.' },
        loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent)
    },
    {
        path: 'impressum',
        title: 'Impressum',
        loadComponent: () => import('./legal/imprint.component').then((m) => m.ImprintComponent)
    },
    {
        path: 'agb',
        title: 'AGB',
        data: { description: 'Allgemeine Geschaeftsbedingungen von 3DBurg: Bestellung, Preise, Zahlung, Lieferung und Widerruf bei individuell gefertigten 3D-Drucken.' },
        loadComponent: () => import('./legal/terms.component').then((m) => m.TermsComponent)
    },
    {
        path: 'datenschutz',
        title: 'Datenschutz',
        data: { description: 'Datenschutzerklaerung von 3DBurg: welche Daten wir fuer Angebot, Bestellung und Versand verarbeiten und wann wir sie loeschen.' },
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
