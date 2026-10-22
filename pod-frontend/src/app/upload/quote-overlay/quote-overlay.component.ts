import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    afterNextRender,
    computed,
    inject,
    input,
    output,
    signal,
    viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
    imports: [DecimalPipe, RouterLink],
    templateUrl: './quote-overlay.component.html',
    styleUrl: './quote-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:keydown.escape)': 'adjust.emit()'
    }
})
export class QuoteOverlayComponent {
    private readonly cart = inject(CartService);
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
    /** "1 Modell" / "3 Modelle": the number of lines in the cart, for the notes under the buttons. */
    readonly cartModelsLabel = computed(() => {
        const count = this.cart.items().length;
        return `${count} ${count === 1 ? 'Modell' : 'Modelle'}`;
    });

    readonly unitPrintTimeLabel = computed(() => formatPrintDuration(this.quote().printTimeSeconds));
    readonly totalPrintTimeLabel = computed(() => formatPrintDuration(this.quote().totalPrintTimeSeconds));
    /** The slicer's warnings are collapsed by default; most customers do not need them. */
    readonly warningsOpen = signal(false);

    constructor() {
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
