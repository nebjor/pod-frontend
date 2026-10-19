import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart/cart.service';
import { OrderResponse, OrderSettings } from '../order/order.models';
import { OrderService, describeOrderError } from '../order/order.service';
import { formatPrintDuration } from '../upload/upload.component';

type CheckoutState = 'idle' | 'submitting' | 'placed';

/** Used until `/api/orders/settings` has answered, and if it never does. */
export const FALLBACK_ORDER_SETTINGS: OrderSettings = {
    currency: 'CHF',
    shippingFlatChf: 9,
    vatEnabled: false,
    vatRate: 0.081,
    quoteValidityDays: 14,
    shipToCountries: ['CH']
};

@Component({
    selector: 'app-checkout',
    imports: [ReactiveFormsModule, DecimalPipe, RouterLink],
    templateUrl: './checkout.component.html',
    styleUrl: './checkout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutComponent {
    private readonly cart = inject(CartService);
    private readonly orderService = inject(OrderService);
    private readonly destroyRef = inject(DestroyRef);

    readonly item = this.cart.item;
    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);
    readonly state = signal<CheckoutState>('idle');
    readonly order = signal<OrderResponse | null>(null);
    readonly errorMessage = signal('');
    readonly fieldErrors = signal<Record<string, string>>({});
    /** Set when the backend recomputed a different price; the customer confirms before retrying. */
    readonly priceChangedTo = signal<number | null>(null);

    readonly customerForm = new FormGroup({
        customerName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
        street: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
        postalCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(16)] }),
        city: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        country: new FormControl('CH', { nonNullable: true, validators: [Validators.required] })
    });

    readonly itemsTotal = computed(() => this.item()?.quote.totalPriceChf ?? 0);
    readonly shipping = computed(() => this.settings().shippingFlatChf);
    readonly total = computed(() => Math.round((this.itemsTotal() + this.shipping()) * 20) / 20);
    readonly printTimeLabel = computed(() => formatPrintDuration(this.item()?.quote.totalPrintTimeSeconds ?? 0));
    /** Calendar day until which the placed order keeps its price (ISO date, timezone-neutral). */
    readonly priceValidUntil = computed(() => this.order()?.quoteExpiresAt.slice(0, 10) ?? '');

    constructor() {
        afterNextRender(() => {
            this.orderService
                .loadSettings()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (settings) => this.settings.set(settings),
                    error: () => {
                        // Keep the fallback; the order response carries the authoritative numbers.
                    }
                });
        });
    }

    fieldError(field: string): string {
        return this.fieldErrors()[field] ?? '';
    }

    submit() {
        const item = this.item();
        if (!item || this.state() === 'submitting') {
            return;
        }
        if (this.customerForm.invalid) {
            this.customerForm.markAllAsTouched();
            return;
        }

        this.state.set('submitting');
        this.errorMessage.set('');
        this.fieldErrors.set({});
        this.priceChangedTo.set(null);

        const customer = this.customerForm.getRawValue();
        this.orderService
            .placeOrder(item.file, {
                ...customer,
                filament: item.filament,
                color: item.color.code,
                quality: item.quality,
                quantity: item.quantity,
                expectedTotalChf: item.quote.totalPriceChf
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (order) => {
                    this.order.set(order);
                    this.state.set('placed');
                    this.cart.clear();
                },
                error: (error: unknown) => {
                    this.state.set('idle');
                    const failure = describeOrderError(error);
                    switch (failure.kind) {
                        case 'price-changed':
                            this.cart.updateQuote(failure.currentQuote);
                            this.priceChangedTo.set(failure.currentQuote.totalPriceChf);
                            break;
                        case 'field-errors':
                            this.fieldErrors.set(failure.errors);
                            this.errorMessage.set('Bitte pruefe die markierten Felder.');
                            break;
                        default:
                            this.errorMessage.set(failure.message);
                    }
                }
            });
    }

    /** The customer accepted the recomputed price; the cart already holds the new quote. */
    acceptNewPrice() {
        this.priceChangedTo.set(null);
        this.submit();
    }
}
