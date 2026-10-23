import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'pod.admin';

/**
 * Holds the owner's credentials for the admin API for the lifetime of the browser tab. The
 * backend checks them on every request (HTTP Basic, stateless), so there is nothing else to
 * keep. sessionStorage survives reloads but not closing the tab.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
    private readonly header = signal<string | null>(null);

    readonly loggedIn = this.header.asReadonly();

    /** Picks up credentials remembered in this tab; browser only. */
    restore() {
        try {
            this.header.set(sessionStorage.getItem(STORAGE_KEY));
        } catch {
            this.header.set(null);
        }
    }

    login(username: string, password: string) {
        const value = 'Basic ' + btoa(`${username}:${password}`);
        this.header.set(value);
        try {
            sessionStorage.setItem(STORAGE_KEY, value);
        } catch {
            // Not remembered across reloads, still usable for this page.
        }
    }

    logout() {
        this.header.set(null);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // Nothing to clear.
        }
    }

    authorizationHeader(): string | null {
        return this.header();
    }
}
