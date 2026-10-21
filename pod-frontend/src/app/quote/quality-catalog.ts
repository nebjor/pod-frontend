import { Injectable, inject, signal } from '@angular/core';
import { qualityLabel } from './quality-labels';
import { QuoteService } from './quote.service';
import { QualityOption } from './quote.models';

/**
 * The quality tiers the shop sells, for pages that show an order but do not load the whole
 * catalogue themselves (checkout, success, status). Fetched once per session on request; until
 * the answer is there, and if it never comes, {@link qualityLabel} falls back to its own list.
 */
@Injectable({ providedIn: 'root' })
export class QualityCatalog {
    private readonly quoteService = inject(QuoteService);
    private readonly options = signal<ReadonlyArray<QualityOption>>([]);
    private requested = false;

    readonly qualities = this.options.asReadonly();

    /** Asks the backend once; browser only, the pages call this after their first render. */
    load() {
        if (this.requested) {
            return;
        }
        this.requested = true;
        this.quoteService.loadOptions().subscribe({
            next: (catalogue) => this.options.set(catalogue.qualities),
            error: () => {
                // The fallback labels stay; the next page that asks tries again.
                this.requested = false;
            }
        });
    }

    label(code: string): string {
        return qualityLabel(code, this.options());
    }
}
