import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';

/**
 * Line at the top of the legal pages for visitors who read the shop in another language: the
 * legal texts themselves stay German, and only the German version is binding. Hidden in German.
 */
@Component({
    selector: 'app-legal-language-notice',
    imports: [TranslatePipe],
    template: `
        @if (i18n.lang() !== 'de') {
            <p class="language-notice" role="note">{{ 'legal.germanOnly' | t }}</p>
        }
    `,
    styles: `
        :host {
            display: block;
        }

        .language-notice {
            margin: 0 0 1.5rem;
            padding: 0.7rem 1rem;
            border: 1px solid var(--border-650);
            border-left: 3px solid var(--accent-300);
            border-radius: 8px;
            background: var(--surface-800);
            color: var(--text-100);
            font-size: 0.9rem;
            line-height: 1.4;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalLanguageNoticeComponent {
    protected readonly i18n = inject(I18nService);
}
