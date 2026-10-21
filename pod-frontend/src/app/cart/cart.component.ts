import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, groupBy, map, mergeMap, of, switchMap } from 'rxjs';
import { FALLBACK_ORDER_SETTINGS, OrderSettings } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { formatPrintDuration } from '../quote/print-duration';
import { qualityLabel } from '../quote/quality-labels';
import { QualityOption } from '../quote/quote.models';
import { QuoteService, describeQuoteError } from '../quote/quote.service';
import { CART_MAX_ITEMS, CartItem, CartService } from './cart.service';

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
    selector: 'app-cart',
    imports: [DecimalPipe, RouterLink],
    templateUrl: './cart.component.html',
    styleUrl: './cart.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartComponent {
    private readonly cart = inject(CartService);
    private readonly quoteService = inject(QuoteService);
    private readonly orderService = inject(OrderService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly quantityChanges = new Subject<QuantityChange>();

    readonly maxItems = CART_MAX_ITEMS;
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
    readonly total = computed(() => Math.round((this.itemsTotal() + this.shipping()) * 100) / 100);

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
                                catchError((error: unknown) => of({ id, error: describeQuoteError(error) }))
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

    qualityLabel(item: CartItem): string {
        return qualityLabel(item.quality, this.qualities());
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
            this.setLineError(id, max !== null ? `Bitte eine Menge zwischen 1 und ${max} angeben.` : 'Bitte eine Menge ab 1 angeben.');
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
