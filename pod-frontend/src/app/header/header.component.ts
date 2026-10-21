import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../account/account.service';
import { CartService } from '../cart/cart.service';

/**
 * Shared by the shop and the admin host. The cart indicator reads the cart, which is empty
 * on the admin host (nothing there can fill it), so it does not show up there. The account
 * link stays blank until the session is known, so a signed-in customer never sees "Anmelden".
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

    readonly accountState = this.account.state;
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
