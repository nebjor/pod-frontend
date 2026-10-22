import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';

import { adminAuthInterceptor } from './admin/admin-auth.interceptor';
import { CartSyncService } from './cart/cart-sync.service';
import { provideHostRoutes } from './host-routes';
import { PageMetaStrategy } from './seo/page-meta.strategy';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The route table depends on the host the app is served on.
    provideRouter([]),
    provideHostRoutes(),
    { provide: TitleStrategy, useClass: PageMetaStrategy },
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([adminAuthInterceptor])),
    // The account cart follows the session; the service watches it from the start.
    provideAppInitializer(() => void inject(CartSyncService))
  ]
};
