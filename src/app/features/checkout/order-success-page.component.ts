import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, map, timer } from 'rxjs';
import { AccountService } from '@core/account/account.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { orderStatusLabel } from '@core/order/order-status-labels';
import { OrderResponse } from '@core/order/order.models';
import { OrderService, recallLastOrder } from '@core/order/order.service';
import { QualityCatalog } from '@core/quote/quality-catalog';

/** How often and how long the page waits for the provider's confirmation to arrive. */
export const CONFIRMATION_POLL_MS = 2000;
export const CONFIRMATION_POLL_ATTEMPTS = 15;

type SuccessState = 'loading' | 'waiting' | 'paid' | 'unpaid' | 'cancelled' | 'missing';

/**
 * Landing page after the payment provider sends the customer back. The redirect alone proves
 * nothing, so the page reads the order from the backend and waits until the provider's
 * confirmation has marked it paid.
 */
@Component({
    selector: 'app-order-success-page',
    imports: [DecimalPipe, RouterLink, TranslatePipe],
    templateUrl: './order-success-page.component.html',
    styleUrl: './order-success-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderSuccessPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly orderService = inject(OrderService);
    private readonly account = inject(AccountService);
    private readonly i18n = inject(I18nService);
    private readonly qualityCatalog = inject(QualityCatalog);
    private readonly destroyRef = inject(DestroyRef);
    private polling?: Subscription;

    private readonly query = toSignal(this.route.queryParamMap.pipe(map((params) => ({
        order: params.get('order') ?? '',
        cancelled: params.get('cancelled') === '1'
    }))), { initialValue: { order: '', cancelled: false } });

    readonly orderNumber = computed(() => this.query().order);
    readonly state = signal<SuccessState>('loading');
    readonly order = signal<OrderResponse | null>(null);
    readonly items = computed(() => this.order()?.items ?? []);
    /** Guests get a hint that their e-mail is all they need for an account; signed-in customers do not. */
    readonly accountState = this.account.state;
    readonly statusLabel = computed(() => {
        const order = this.order();
        return order ? orderStatusLabel(order.status, this.i18n.t) : '';
    });
    /** Query for the status page, the same the order mail links to. */
    readonly statusLinkParams = computed(() => {
        const order = this.order();
        return order ? { nr: order.orderNumber, email: order.customerEmail } : {};
    });
    /** Day until which an unpaid order keeps its price, as dd.mm.yyyy; empty without an order. */
    readonly priceValidUntil = computed(() => {
        const iso = this.order()?.quoteExpiresAt;
        if (!iso) {
            return '';
        }
        const [year, month, day] = iso.slice(0, 10).split('-');
        return `${day}.${month}.${year}`;
    });

    constructor() {
        // sessionStorage and polling exist in the browser only; the route is prerendered too.
        afterNextRender(() => {
            this.qualityCatalog.load();
            this.load();
        });
        this.destroyRef.onDestroy(() => this.polling?.unsubscribe());
    }

    qualityLabel(code: string): string {
        return this.qualityCatalog.label(code);
    }

    /** Reads the order and, while it is still unpaid, keeps asking for a while. */
    load() {
        const reference = recallLastOrder();
        const orderNumber = this.orderNumber() || reference?.orderNumber || '';
        if (!orderNumber || !reference?.email) {
            this.state.set('missing');
            return;
        }

        this.polling?.unsubscribe();
        this.polling = timer(0, CONFIRMATION_POLL_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((attempt) => {
                this.orderService.find(orderNumber, reference.email).subscribe({
                    next: (order) => {
                        this.order.set(order);
                        if (order.status !== 'NEW') {
                            this.state.set(order.status === 'CANCELLED' ? 'cancelled' : 'paid');
                            this.polling?.unsubscribe();
                        } else if (this.query().cancelled || attempt + 1 >= CONFIRMATION_POLL_ATTEMPTS) {
                            this.state.set(this.query().cancelled ? 'cancelled' : 'unpaid');
                            this.polling?.unsubscribe();
                        } else {
                            this.state.set('waiting');
                        }
                    },
                    error: () => {
                        this.state.set('missing');
                        this.polling?.unsubscribe();
                    }
                });
            });
    }
}
