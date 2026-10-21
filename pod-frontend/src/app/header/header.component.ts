import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AccountService } from '../account/account.service';
import { CartService } from '../cart/cart.service';

/** Lines shown in the cart preview; the rest is summed up as "+ N weitere Positionen". */
export const CART_PREVIEW_MAX_ITEMS = 4;

/** Moving the cursor from the indicator into the panel may cross a gap; the panel waits this long. */
export const CART_PREVIEW_CLOSE_DELAY_MS = 150;

/**
 * Shared by the shop and the admin host. The cart indicator reads the cart, which is empty
 * on the admin host (nothing there can fill it), so it does not show up there. The account
 * link stays blank until the session is known, so a signed-in customer never sees "Anmelden".
 *
 * Hovering or focusing the indicator opens a preview of the cart under it. The indicator
 * stays a plain link, so a tap on a touch device goes straight to the cart page; the preview
 * closes on its own with the navigation.
 */
@Component({
    selector: 'app-header',
    imports: [MatToolbarModule, MatButtonModule, RouterLink, DecimalPipe],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
    private readonly router = inject(Router);
    private readonly cart = inject(CartService);
    private readonly account = inject(AccountService);
    private readonly cartLink = viewChild<ElementRef<HTMLAnchorElement>>('cartLink');
    private readonly previewOpenState = signal(false);
    private closeTimer: ReturnType<typeof setTimeout> | null = null;

    readonly accountState = this.account.state;
    readonly cartIsEmpty = this.cart.isEmpty;
    readonly cartCount = this.cart.count;
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;
    readonly previewOpen = computed(() => this.previewOpenState() && !this.cartIsEmpty());
    readonly previewItems = computed(() => this.cart.items().slice(0, CART_PREVIEW_MAX_ITEMS));
    readonly previewHiddenCount = computed(() => Math.max(0, this.cart.items().length - CART_PREVIEW_MAX_ITEMS));

    constructor() {
        // Whatever opened the preview, a navigation ends it: the header stays on the next page.
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationStart),
                takeUntilDestroyed()
            )
            .subscribe(() => this.closePreview());
        inject(DestroyRef).onDestroy(() => this.cancelScheduledClose());
    }

    goHome() {
        this.router.navigate(['/']);
    }

    goToUpload() {
        this.router.navigate(['/upload']);
    }

    openPreview() {
        this.cancelScheduledClose();
        this.previewOpenState.set(true);
    }

    closePreview() {
        this.cancelScheduledClose();
        this.previewOpenState.set(false);
    }

    /** Mouse leaving the widget; a cursor on its way into the panel gets a short grace period. */
    scheduleClosePreview() {
        this.cancelScheduledClose();
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            this.previewOpenState.set(false);
        }, CART_PREVIEW_CLOSE_DELAY_MS);
    }

    /** Keyboard focus moving out of the whole widget closes the preview; moving within keeps it. */
    onWidgetFocusOut(event: FocusEvent) {
        const widget = event.currentTarget as HTMLElement;
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !widget.contains(next)) {
            this.closePreview();
        }
    }

    onEscape() {
        if (!this.previewOpen()) {
            return;
        }
        // Focus first: focusing the indicator raises focusin, which would reopen a closed preview.
        this.cartLink()?.nativeElement.focus();
        this.closePreview();
    }

    /** The panel is one big link to the cart page; only its own links (e.g. "Zur Kasse") go elsewhere. */
    onPreviewClick(event: MouseEvent) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('a')) {
            return;
        }
        void this.router.navigateByUrl('/warenkorb');
    }

    private cancelScheduledClose() {
        if (this.closeTimer !== null) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    }
}
