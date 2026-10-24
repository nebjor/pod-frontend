import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // One page per order number cannot be prerendered; the Node server renders it on request.
    path: 'konto/bestellungen/:orderNumber',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
