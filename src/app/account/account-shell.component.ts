import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslationKey } from '../i18n/de';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LOGIN_PATH } from './account.models';
import { AccountService } from './account.service';

type ShellState = 'loading' | 'ready';

/**
 * Frame of the signed-in account area: a navigation on the left (a tab row on narrow screens)
 * and the active page next to it. It asks once for the session; anyone without one is sent to
 * the login page and comes back to the page they wanted. The pages inside only render for a
 * signed-in customer and read the account from AccountService.
 */
@Component({
    selector: 'app-account-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
    templateUrl: './account-shell.component.html',
    styleUrls: ['./customer-page.scss', './account-shell.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountShellComponent {
    private readonly account = inject(AccountService);
    private readonly router = inject(Router);
    private readonly i18n = inject(I18nService);
    private readonly destroyRef = inject(DestroyRef);

    readonly customer = this.account.account;
    readonly deleted = this.account.deleted;
    readonly state = signal<ShellState>('loading');
    readonly loggingOut = signal(false);
    readonly errorMessage = signal('');

    readonly items: ReadonlyArray<{ labelKey: TranslationKey; path: string; exact: boolean }> = [
        { labelKey: 'account.nav.orders', path: '/konto', exact: true },
        { labelKey: 'account.nav.address', path: '/konto/adresse', exact: false },
        { labelKey: 'account.nav.account', path: '/konto/passwort', exact: false }
    ];

    constructor() {
        // The session is a cookie; only the browser can tell whether there is one. On the
        // server nothing runs here, so prerendering shows the neutral loading card.
        afterNextRender(() => this.start());
    }

    start() {
        void this.account.load().then(() => {
            if (!this.account.isSignedIn()) {
                // A deleted account has no session either; the farewell card replaces the page.
                if (!this.deleted()) {
                    const returnTo = this.router.url.split(/[?#]/)[0];
                    void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo } });
                }
                return;
            }
            this.state.set('ready');
        });
    }

    logout() {
        if (this.loggingOut()) {
            return;
        }
        this.loggingOut.set(true);
        this.errorMessage.set('');
        this.account
            .logout()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => void this.router.navigateByUrl('/'),
                error: () => {
                    this.loggingOut.set(false);
                    this.errorMessage.set(this.i18n.t('account.logoutError'));
                }
            });
    }
}
