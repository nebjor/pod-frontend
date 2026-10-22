import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    afterNextRender,
    DestroyRef,
    computed,
    inject,
    input,
    output,
    signal,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../account/account.service';
import { FALLBACK_ORDER_SETTINGS, OrderSettings } from '../../order/order.models';
import { OrderService } from '../../order/order.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CART_MAX_ITEMS, CartItem, CartService } from '../../cart/cart.service';
import { formatPrintDuration } from '../../quote/print-duration';
import { ColorOption, QuoteResponse } from '../../quote/quote.models';

/**
 * The full-screen result of a quote: the price, the facts behind it and the two ways on,
 * into the cart or back to the configuration. It exists only while the quote is on screen,
 * so it takes the focus when it appears and gives it back through {@link adjust} on Escape.
 */
/**
 * Brings step 3 into view. On wide screens the card sits beside the preview under the page
 * title, so the page scrolls to the top; on phones the card is below the preview, so it is
 * scrolled to directly. Both calls are missing in jsdom, hence the optional calls.
 */
export function revealStep(el: HTMLElement) {
    if (window.matchMedia?.('(min-width: 1024px)').matches) {
        window.scrollTo?.({ top: 0 });
    } else {
        el.scrollIntoView?.({ block: 'start' });
    }
}

@Component({
    selector: 'app-quote-overlay',
    imports: [DecimalPipe, RouterLink, TranslatePipe],
    templateUrl: './quote-overlay.component.html',
    styleUrl: './quote-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:keydown.escape)': 'adjust.emit()'
    }
})
export class QuoteOverlayComponent {
    private readonly cart = inject(CartService);
    private readonly i18n = inject(I18nService);
    private readonly orderService = inject(OrderService);
    private readonly destroyRef = inject(DestroyRef);
    protected readonly account = inject(AccountService);
    private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

    readonly quote = input.required<QuoteResponse>();
    readonly fileName = input('');
    /** The colour the customer chose; the quote carries its price tier, not its name. */
    readonly color = input<ColorOption | undefined>(undefined);
    readonly qualityLabel = input('');
    /** The line just added; the confirmation with the next steps replaces the buttons while set. */
    readonly addedItem = input<CartItem | null>(null);
    readonly canAddToCart = input(true);

    readonly addToCart = output<void>();
    /** Back to the configuration with the same model and choices. */
    readonly adjust = output<void>();
    readonly uploadAnother = output<void>();

    readonly cartCount = this.cart.count;
    readonly cartTotal = this.cart.itemsTotal;
    readonly cartCurrency = this.cart.currency;
    readonly cartIsFull = this.cart.isFull;
    readonly maxCartItems = CART_MAX_ITEMS;
    /** "1 model" / "3 models": the number of lines in the cart, for the notes under the buttons. */
    readonly cartModelsLabel = computed(() => {
        const count = this.cart.items().length;
        return this.i18n.t(count === 1 ? 'common.modelOne' : 'common.modelMany', { count });
    });

    readonly unitPrintTimeLabel = computed(() => formatPrintDuration(this.quote().printTimeSeconds));
    readonly totalPrintTimeLabel = computed(() => formatPrintDuration(this.quote().totalPrintTimeSeconds));
    /** The slicer's warnings are collapsed by default; most customers do not need them. */
    readonly warningsOpen = signal(false);

    /** The setup fee comes from the shop settings; the fallback shows until they have arrived. */
    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);

    constructor() {
        this.orderService
            .loadSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => this.settings.set(settings),
                error: () => {
                    // Keep the fallback; the cart and checkout show the authoritative numbers.
                }
            });

        // The customer clicked "Preis berechnen" at the bottom of the configuration; bring the
        // result into view at the top of the card and move focus there for screen readers.
        afterNextRender(() => {
            const el = this.dialog().nativeElement;
            revealStep(el);
            el.focus({ preventScroll: true });
        });
    }

    toggleWarnings() {
        this.warningsOpen.update((open) => !open);
    }
}
