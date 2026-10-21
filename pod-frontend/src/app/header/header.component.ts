import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../cart/cart.service';

/**
 * Shared by the shop and the admin host. The cart indicator reads the cart, which is empty
 * on the admin host (nothing there can fill it), so it does not show up there.
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

    readonly cartIsEmpty = this.cart.isEmpty;
    readonly cartCount = this.cart.count;
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;

    goHome() {
        this.router.navigate(['/']);
    }

    goToUpload() {
        this.router.navigate(['/upload']);
    }
}
