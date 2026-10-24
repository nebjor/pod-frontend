import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, defer, map, of, repeat, switchMap, timer } from 'rxjs';
import { LOGIN_PATH, orderPath } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { orderStatusLabel } from '@core/order/order-status-labels';
import { OrderResponse } from '@core/order/order.models';
import { recallLastOrder } from '@core/order/order.service';
import { QualityCatalog } from '@core/quote/quality-catalog';

/** How often and how long the page waits for the provider's confirmation to arrive. */
export const CONFIRMATION_POLL_MS = 2000;
export const CONFIRMATION_POLL_ATTEMPTS = 15;

type SuccessState = 'loading' | 'waiting' | 'checking' | 'paid' | 'unpaid' | 'cancelled' | 'missing';

type PollResult = { order: OrderResponse } | { error: unknown };

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
    private readonly router = inject(Router);
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
    readonly statusLabel = computed(() => {
        const order = this.order();
        return order ? orderStatusLabel(order.status, this.i18n.t) : '';
    });
    /** The order's page under the account, the same the order mail links to. */
    readonly orderLink = computed(() => orderPath(this.order()?.orderNumber ?? this.orderNumber()));
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

    /**
     * Reads the order and, while it is still unpaid, keeps asking for a while. Requests never
     * overlap (switchMap inside a sequential repeat) and a new load() replaces the old run, so a
     * late answer cannot overwrite newer state. A 401 goes to the login and back here, a 404 is
     * a missing order; a network or server error keeps the polling going with growing pauses.
     */
    load() {
        const orderNumber = this.orderNumber() || recallLastOrder()?.orderNumber || '';
        if (!orderNumber) {
            this.state.set('missing');
            return;
        }

        this.polling?.unsubscribe();
        let attempt = 0;
        let failures = 0;
        this.polling = defer(() => timer(attempt === 0 ? 0 : CONFIRMATION_POLL_MS * 2 ** Math.min(failures, 3)))
            .pipe(
                switchMap(() =>
                    this.account.order(orderNumber).pipe(
                        map((order) => ({ order }) as PollResult),
                        catchError((error: unknown) => of({ error } as PollResult))
                    )
                ),
                repeat(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((result) => {
                attempt++;
                if ('order' in result) {
                    failures = 0;
                    this.applyOrder(result.order, attempt);
                } else {
                    failures++;
                    this.applyError(result.error, attempt);
                }
            });
    }

    private applyOrder(order: OrderResponse, attempt: number) {
        this.order.set(order);
        if (order.status !== 'NEW') {
            this.state.set(order.status === 'CANCELLED' ? 'cancelled' : 'paid');
            this.polling?.unsubscribe();
        } else if (this.query().cancelled || attempt >= CONFIRMATION_POLL_ATTEMPTS) {
            this.state.set(this.query().cancelled ? 'cancelled' : 'unpaid');
            this.polling?.unsubscribe();
        } else {
            this.state.set('waiting');
        }
    }

    private applyError(error: unknown, attempt: number) {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        if (status === 401) {
            this.polling?.unsubscribe();
            void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo: this.router.url.split('#')[0] } });
        } else if (status === 404) {
            this.state.set('missing');
            this.polling?.unsubscribe();
        } else {
            // Unreachable or failing for now: the payment may well have gone through.
            this.state.set('checking');
            if (attempt >= CONFIRMATION_POLL_ATTEMPTS) {
                this.polling?.unsubscribe();
            }
        }
    }
}
