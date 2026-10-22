import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountResponse } from '../account/account.models';
import { AccountService } from '../account/account.service';
import { CartItem, CartService } from '../cart/cart.service';
import { I18nService } from '../i18n/i18n.service';
import { BUSINESS } from '../legal/business';
import { FALLBACK_ORDER_SETTINGS, OrderFailure, OrderRequest, OrderResponse, OrderSettings } from '../order/order.models';
import { OrderService, describeOrderError, rememberLastOrder } from '../order/order.service';
import { formatPrintDuration } from '../quote/print-duration';
import { TranslatePipe } from '../i18n/translate.pipe';
import { QualityCatalog } from '../quote/quality-catalog';

type CheckoutState = 'idle' | 'submitting' | 'placed';

@Component({
    selector: 'app-checkout',
    imports: [ReactiveFormsModule, DecimalPipe, RouterLink, TranslatePipe],
    templateUrl: './checkout.component.html',
    styleUrl: './checkout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutComponent {
    private readonly cart = inject(CartService);
    private readonly orderService = inject(OrderService);
    private readonly account = inject(AccountService);
    private readonly qualityCatalog = inject(QualityCatalog);
    private readonly router = inject(Router);
    private readonly i18n = inject(I18nService);
    private readonly destroyRef = inject(DestroyRef);
    /** Lines uploaded again during the current submit; a second expiry of the same line is an error. */
    private reuploaded = new Set<string>();

    /** Where a customer writes to cancel before production starts (see the terms). */
    readonly supportEmail = BUSINESS.email;
    readonly accountState = this.account.state;
    readonly customer = this.account.account;
    readonly items = this.cart.items;
    readonly ready = this.cart.ready;
    readonly isEmpty = this.cart.isEmpty;
    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);
    readonly state = signal<CheckoutState>('idle');
    readonly order = signal<OrderResponse | null>(null);
    readonly errorMessage = signal('');
    readonly fieldErrors = signal<Record<string, string>>({});
    /** Set when the backend recomputed a different total; the customer confirms before retrying. */
    readonly priceChangedTo = signal<number | null>(null);

    readonly customerForm = new FormGroup({
        customerName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
        street: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
        postalCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(16)] }),
        city: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        country: new FormControl('CH', { nonNullable: true, validators: [Validators.required] }),
        termsAccepted: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
    });

    readonly itemsTotal = this.cart.itemsTotal;
    readonly currency = this.cart.currency;
    readonly shipping = computed(() => this.settings().shippingFlatChf);
    readonly total = computed(() => Math.round((this.itemsTotal() + this.shipping()) * 100) / 100);
    /** Calendar day until which the placed order keeps its price, as dd.mm.yyyy (timezone-neutral). */
    readonly priceValidUntil = computed(() => {
        const iso = this.order()?.quoteExpiresAt;
        if (!iso) {
            return '';
        }
        const [year, month, day] = iso.slice(0, 10).split('-');
        return `${day}.${month}.${year}`;
    });
    /** Validation messages the backend attached to cart lines rather than address fields. */
    readonly itemErrors = computed(() =>
        Object.entries(this.fieldErrors())
            .filter(([field]) => field.startsWith('items'))
            .map(([field, message]) => `${field}: ${message}`)
    );

    constructor() {
        afterNextRender(() => {
            this.qualityCatalog.load();
            void this.account.load().then(() => {
                const customer = this.customer();
                if (customer) {
                    this.prefillFrom(customer);
                }
            });
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

    /**
     * The backend may key address errors by the request's nested field (`customer.name`) or by
     * the flat name the form uses; both are shown next to the input.
     */
    fieldError(field: string): string {
        const errors = this.fieldErrors();
        const keys = field === 'customerName' ? ['customer.name', 'customerName', 'name'] : [`customer.${field}`, field];
        return keys.map((key) => errors[key]).find((message) => !!message) ?? '';
    }

    printTimeLabel(item: CartItem): string {
        return formatPrintDuration(item.quote.totalPrintTimeSeconds);
    }

    qualityLabel(code: string): string {
        return this.qualityCatalog.label(code);
    }

    submit() {
        if (this.isEmpty() || this.state() === 'submitting') {
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
        this.reuploaded = new Set();
        this.send();
    }

    /** The customer accepted the recomputed price; the cart already holds the new quotes. */
    acceptNewPrice() {
        this.priceChangedTo.set(null);
        this.submit();
    }

    private send() {
        const items = this.items();
        const { termsAccepted: _accepted, customerName, ...address } = this.customerForm.getRawValue();
        const request: OrderRequest = {
            customer: { name: customerName, ...address },
            items: items.map((item) => ({
                modelId: item.modelId,
                fileName: item.fileName,
                filament: item.filament,
                color: item.color.code,
                quality: item.quality,
                quantity: item.quantity
            })),
            expectedTotalChf: this.itemsTotal()
        };

        this.orderService
            .placeOrder(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (order) => this.placed(order),
                error: (error: unknown) => this.failed(describeOrderError(error, this.i18n.t), items)
            });
    }

    private placed(order: OrderResponse) {
        this.order.set(order);
        this.state.set('placed');
        this.cart.clear();
        rememberLastOrder({ orderNumber: order.orderNumber, email: order.customerEmail });
        if (order.paymentUrl) {
            this.goToPayment(order.paymentUrl);
        }
    }

    private failed(failure: OrderFailure, sent: ReadonlyArray<CartItem>) {
        switch (failure.kind) {
            case 'model-expired': {
                const item = failure.itemIndex === null ? undefined : sent[failure.itemIndex];
                if (item && this.cart.find(item.id) && !this.reuploaded.has(item.id)) {
                    // The backend dropped this model: upload it once more and send the order again.
                    this.reuploaded.add(item.id);
                    this.cart
                        .reuploadModel(item.id)
                        .pipe(takeUntilDestroyed(this.destroyRef))
                        .subscribe({ next: () => this.send(), error: () => this.failExpired(item) });
                    return;
                }
                this.failExpired(item);
                break;
            }
            case 'price-changed':
                sent.forEach((item, index) => {
                    const quote = failure.currentQuotes[index];
                    if (quote) {
                        this.cart.replaceQuote(item.id, quote);
                    }
                });
                this.priceChangedTo.set(failure.totals.total);
                this.state.set('idle');
                break;
            case 'field-errors':
                this.fieldErrors.set(failure.errors);
                this.errorMessage.set(this.i18n.t('common.fieldsCheck'));
                this.state.set('idle');
                break;
            default:
                this.errorMessage.set(failure.message);
                this.state.set('idle');
        }
    }

    /** Fills in what the account knows, leaving anything the customer has typed already alone. */
    private prefillFrom(customer: AccountResponse) {
        const controls = this.customerForm.controls;
        const fill = (control: FormControl<string>, value: string | null) => {
            if (value && control.value.trim() === '') {
                control.setValue(value);
            }
        };
        fill(controls.customerName, customer.name);
        fill(controls.email, customer.email);
        fill(controls.street, customer.street);
        fill(controls.postalCode, customer.postalCode);
        fill(controls.city, customer.city);
        if (customer.country && controls.country.pristine) {
            controls.country.setValue(customer.country);
        }
    }

    private failExpired(item: CartItem | undefined) {
        this.state.set('idle');
        this.errorMessage.set(
            item
                ? this.i18n.t('checkout.error.expiredNamed', { name: item.fileName })
                : this.i18n.t('checkout.error.expired')
        );
    }

    /**
     * The mock provider's page is a route of this app; a real provider's page is another
     * origin and needs a full navigation.
     */
    private goToPayment(url: string) {
        const origin = typeof window === 'undefined' ? '' : window.location.origin;
        if (url.startsWith('/')) {
            void this.router.navigateByUrl(url);
        } else if (origin && url.startsWith(origin + '/')) {
            void this.router.navigateByUrl(url.slice(origin.length));
        } else {
            window.location.assign(url);
        }
    }
}
