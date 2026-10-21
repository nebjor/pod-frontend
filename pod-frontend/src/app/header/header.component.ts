import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../account/account.service';
import { CartService } from '../cart/cart.service';
import { qualityLabel } from '../quote/quality-labels';
import { HoverMenuDirective } from './hover-menu.directive';

/** Lines shown in the cart preview; the rest is summed up as "+ N weitere Positionen". */
export const CART_PREVIEW_MAX_ITEMS = 4;

/**
 * Shared by the shop and the admin host. The account link stays blank until the session is
 * known, so a signed-in customer never sees "Anmelden".
 *
 * The cart indicator and, once signed in, the account link each open a panel under them on
 * hover or keyboard focus ({@link HoverMenuDirective}). The cart panel previews the lines or,
 * while the cart is empty, invites the customer to upload a model; the account panel lists
 * the account's sections and the logout. Both triggers stay plain links, so a tap on a touch
 * device navigates; the panel closes on its own with the navigation.
 */
@Component({
    selector: 'app-header',
    imports: [MatToolbarModule, MatButtonModule, RouterLink, DecimalPipe, HoverMenuDirective],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
    private readonly router = inject(Router);
    private readonly cart = inject(CartService);
    private readonly account = inject(AccountService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly loggingOutState = signal(false);

    readonly accountState = this.account.state;
    readonly accountEmail = computed(() => this.account.account()?.email ?? '');
    readonly loggingOut = this.loggingOutState.asReadonly();
    readonly cartIsEmpty = this.cart.isEmpty;
    readonly cartCount = this.cart.count;
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;
    readonly previewItems = computed(() => this.cart.items().slice(0, CART_PREVIEW_MAX_ITEMS));
    readonly previewHiddenCount = computed(() => Math.max(0, this.cart.items().length - CART_PREVIEW_MAX_ITEMS));

    goHome() {
        this.router.navigate(['/']);
    }

    /** The header is on every page and does not fetch the catalogue; the fallback list serves it. */
    qualityLabel(code: string): string {
        return qualityLabel(code);
    }

    goToUpload() {
        this.router.navigate(['/upload']);
    }

    /**
     * The filled panel is one big link to the cart page; only its own links (e.g. "Zur Kasse")
     * go elsewhere. The empty panel has nothing to show on the cart page and only its button.
     */
    onPreviewClick(event: MouseEvent) {
        const target = event.target as HTMLElement | null;
        if (this.cartIsEmpty() || target?.closest('a')) {
            return;
        }
        void this.router.navigateByUrl('/warenkorb');
    }

    /**
     * Ends the session and goes to the landing page. The header has no room for an error
     * message; when the request fails the customer stays signed in and can try again.
     */
    logout() {
        if (this.loggingOutState()) {
            return;
        }
        this.loggingOutState.set(true);
        this.account
            .logout()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.loggingOutState.set(false);
                    void this.router.navigateByUrl('/');
                },
                error: () => this.loggingOutState.set(false)
            });
    }
}
