import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // One page per order number cannot be prerendered; the Node server renders it on request.
    path: 'konto/bestellungen/:orderNumber',
    renderMode: RenderMode.Server
  },
  {
    // Old confirmation mails link /bestellung?nr=...; a prerendered redirect would drop the
    // query, so the server resolves it on request and keeps the order number.
    path: 'bestellung',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
