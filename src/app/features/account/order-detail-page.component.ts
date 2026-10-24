import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LOGIN_PATH, ORDERS_PATH, orderPath } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';
import { I18nService, Translate } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { orderStatusLabel } from '@core/order/order-status-labels';
import { OrderResponse } from '@core/order/order.models';
import { QualityCatalog } from '@core/quote/quality-catalog';
import { OrderStatusTimelineComponent } from './order-status-timeline.component';

type DetailState = 'loading' | 'found' | 'not-found' | 'error';

/**
 * One order of the signed-in customer, `/konto/bestellungen/:orderNumber`. It renders inside
 * the account shell, which has already made sure there is a session; the backend answers 404
 * for an order that is not the account's.
 */
@Component({
    selector: 'app-order-detail-page',
    imports: [DatePipe, DecimalPipe, RouterLink, OrderStatusTimelineComponent, TranslatePipe],
    templateUrl: './order-detail-page.component.html',
    styleUrls: ['../../shared/styles/customer-page.scss', './order-detail-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly account = inject(AccountService);
    private readonly i18n = inject(I18nService);
    private readonly qualityCatalog = inject(QualityCatalog);
    private readonly destroyRef = inject(DestroyRef);

    readonly ordersPath = ORDERS_PATH;
    readonly orderNumber = toSignal(this.route.paramMap.pipe(map((params) => params.get('orderNumber') ?? '')), {
        initialValue: ''
    });
    readonly state = signal<DetailState>('loading');
    readonly order = signal<OrderResponse | null>(null);
    readonly errorMessage = signal('');
    readonly statusLabel = computed(() => {
        const order = this.order();
        return order ? orderStatusLabel(order.status, this.i18n.t) : '';
    });
    /** Only a new order still waits for its payment; the backend hands out the link while it does. */
    readonly paymentUrl = computed(() => {
        const order = this.order();
        return order?.status === 'NEW' && order.paymentUrl ? order.paymentUrl : null;
    });

    constructor() {
        // The API is only asked in the browser; prerendering renders the loading state.
        afterNextRender(() => {
            this.qualityCatalog.load();
            this.load();
        });
    }

    qualityLabel(code: string): string {
        return this.qualityCatalog.label(code);
    }

    load() {
        const orderNumber = this.orderNumber();
        this.state.set('loading');
        this.account
            .order(orderNumber)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (order) => {
                    this.order.set(order);
                    this.state.set('found');
                },
                error: (error: unknown) => {
                    this.order.set(null);
                    if (!this.account.isSignedIn()) {
                        void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo: orderPath(orderNumber) } });
                    } else if (error instanceof HttpErrorResponse && error.status === 404) {
                        this.state.set('not-found');
                    } else {
                        this.errorMessage.set(describeLoadError(error, this.i18n.t));
                        this.state.set('error');
                    }
                }
            });
    }
}

function describeLoadError(error: unknown, t: Translate): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
        return t('error.unreachable');
    }
    return t('order.error.load');
}
