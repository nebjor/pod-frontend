import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { orderStatusLabel } from '@core/order/order-status-labels';
import { OrderResponse } from '@core/order/order.models';
import { LOGIN_PATH } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';
import { CartService } from '@core/cart/cart.service';

type OrdersState = 'loading' | 'ready' | 'error';

/**
 * "Bestellungen": the signed-in customer's orders. Rendered inside the account shell, which
 * has already made sure there is a session.
 */
@Component({
    selector: 'app-orders-page',
    imports: [RouterLink, DatePipe, DecimalPipe, TranslatePipe],
    templateUrl: './orders-page.component.html',
    styleUrls: ['../../shared/styles/customer-page.scss', './orders-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPageComponent {
    private readonly account = inject(AccountService);
    private readonly cart = inject(CartService);
    /** What is waiting in the cart: the orders page points there when nothing was ordered yet. */
    readonly cartCount = this.cart.count;
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;
    private readonly router = inject(Router);
    private readonly i18n = inject(I18nService);
    private readonly destroyRef = inject(DestroyRef);

    readonly ordersState = signal<OrdersState>('loading');
    private readonly orderList = signal<OrderResponse[]>([]);
    /** Newest first, whatever order the backend chose. */
    readonly orders = computed(() => [...this.orderList()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

    constructor() {
        this.loadOrders();
    }

    loadOrders() {
        this.ordersState.set('loading');
        this.account
            .orders()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (orders) => {
                    this.orderList.set(orders);
                    this.ordersState.set('ready');
                },
                error: () => {
                    if (!this.account.isSignedIn()) {
                        void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo: '/konto' } });
                        return;
                    }
                    this.ordersState.set('error');
                }
            });
    }

    statusLabel(order: OrderResponse): string {
        return orderStatusLabel(order.status, this.i18n.t);
    }
}
