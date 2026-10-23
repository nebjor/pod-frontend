import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, groupBy, map, mergeMap, of, switchMap } from 'rxjs';
import { AccountService } from '@core/account/account.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { FALLBACK_ORDER_SETTINGS, OrderSettings, setupFeeFor } from '@core/order/order.models';
import { OrderService } from '@core/order/order.service';
import { formatPrintDuration } from '@core/quote/print-duration';
import { qualityLabel, quantityDiscountPercent } from '@core/quote/quality-labels';
import { QualityOption } from '@core/quote/quote.models';
import { QuoteService, describeQuoteError } from '@core/quote/quote.service';
import { CartSyncService } from '@core/cart/cart-sync.service';
import { CART_MAX_ITEMS, CartItem, CartService } from '@core/cart/cart.service';

/** A quantity change re-slices the model; typing or clicking the spinner should not flood the slicer. */
export const CART_REQUOTE_DEBOUNCE_MS = 500;

interface QuantityChange {
    id: string;
    quantity: number;
}

/**
 * The cart page: every configured model with its quantity and line total, and the order
 * summary. Changing a quantity asks the backend for a new quote for that line.
 */
@Component({
    selector: 'app-cart-page',
    imports: [DecimalPipe, RouterLink, TranslatePipe],
    templateUrl: './cart-page.component.html',
    styleUrl: './cart-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartPageComponent {
    private readonly cart = inject(CartService);
    private readonly cartSync = inject(CartSyncService);
    private readonly quoteService = inject(QuoteService);
    private readonly orderService = inject(OrderService);
    private readonly i18n = inject(I18nService);
    private readonly account = inject(AccountService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly quantityChanges = new Subject<QuantityChange>();

    readonly maxItems = CART_MAX_ITEMS;
    /** Set when signing in merged more lines than an order takes. */
    readonly notice = this.cartSync.notice;
    readonly items = this.cart.items;
    readonly ready = this.cart.ready;
    readonly isEmpty = this.cart.isEmpty;
    readonly isFull = this.cart.isFull;
    readonly itemsTotal = this.cart.itemsTotal;
    readonly currency = this.cart.currency;
    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);
    /** Quantity limit from the catalogue; until it is known the backend alone validates. */
    readonly maxQuantity = signal<number | null>(null);
    readonly qualities = signal<ReadonlyArray<QualityOption>>([]);
    /** Lines whose new quote is being computed. */
    readonly pending = signal<ReadonlySet<string>>(new Set());
    readonly lineErrors = signal<Record<string, string>>({});

    readonly shipping = computed(() => this.settings().shippingFlatChf);
    readonly isSignedIn = this.account.isSignedIn;
    readonly setupFee = computed(() => setupFeeFor(this.settings(), this.isSignedIn()));
    readonly accountSetupFee = computed(() => this.settings().setupFeeAccountChf);
    readonly total = computed(() => Math.round((this.itemsTotal() + this.setupFee() + this.shipping()) * 100) / 100);

    constructor() {
        this.quantityChanges
            .pipe(
                // Each line debounces on its own; a change on one line never drops another's.
                groupBy((change) => change.id),
                mergeMap((line) =>
                    line.pipe(
                        debounceTime(CART_REQUOTE_DEBOUNCE_MS),
                        switchMap(({ id, quantity }) =>
                            this.cart.updateQuantity(id, quantity).pipe(
                                map(() => ({ id, error: '' })),
                                catchError((error: unknown) => of({ id, error: describeQuoteError(error, this.i18n.t) }))
                            )
                        )
                    )
                ),
                takeUntilDestroyed()
            )
            .subscribe(({ id, error }) => {
                this.setPending(id, false);
                this.setLineError(id, error);
            });

        // Settings and catalogue are fetched in the browser only; the page is prerendered.
        afterNextRender(() => this.loadSettingsAndCatalogue());
    }

    dismissNotice() {
        this.cartSync.dismissNotice();
    }

    qualityLabel(item: CartItem): string {
        return qualityLabel(item.quality, this.qualities(), this.i18n.t);
    }

    /** Percent saved per piece in this batch, 0 when nothing worth showing. */
    discountPercent(item: CartItem): number {
        return quantityDiscountPercent(item.quote);
    }

    printTimeLabel(item: CartItem): string {
        return formatPrintDuration(item.quote.totalPrintTimeSeconds);
    }

    lineError(id: string): string {
        return this.lineErrors()[id] ?? '';
    }

    onQuantityChange(id: string, event: Event) {
        this.changeQuantity(id, (event.target as HTMLInputElement).value);
    }

    /** Validates the new quantity and schedules the re-quote; invalid values are reported inline. */
    changeQuantity(id: string, value: string | number) {
        const quantity = Number(value);
        const max = this.maxQuantity();
        if (!Number.isInteger(quantity) || quantity < 1 || (max !== null && quantity > max)) {
            this.setLineError(
                id,
                max !== null ? this.i18n.t('cart.error.quantityRange', { max }) : this.i18n.t('cart.error.quantityMin')
            );
            return;
        }

        this.setLineError(id, '');
        const item = this.cart.find(id);
        if (!item || item.quantity === quantity) {
            return;
        }
        this.setPending(id, true);
        this.quantityChanges.next({ id, quantity });
    }

    remove(id: string) {
        this.cart.remove(id);
        this.setPending(id, false);
        this.setLineError(id, '');
    }

    private loadSettingsAndCatalogue() {
        this.orderService
            .loadSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => this.settings.set(settings),
                error: () => {
                    // Keep the fallback; the checkout shows the authoritative numbers.
                }
            });
        this.quoteService
            .loadOptions()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (options) => {
                    this.maxQuantity.set(options.maxQuantity);
                    this.qualities.set(options.qualities);
                },
                error: () => {
                    // Without the catalogue the fallback quality labels apply and the backend checks quantities.
                }
            });
    }

    private setPending(id: string, pending: boolean) {
        this.pending.update((current) => {
            const next = new Set(current);
            if (pending) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    private setLineError(id: string, error: string) {
        this.lineErrors.update(({ [id]: _previous, ...rest }) => (error ? { ...rest, [id]: error } : rest));
    }
}
