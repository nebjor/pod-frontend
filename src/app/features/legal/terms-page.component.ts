import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '@core/config/business';
import { LegalLanguageNoticeComponent } from './legal-language-notice.component';

/** AGB: the contract the customer accepts at checkout. */
@Component({
    selector: 'app-terms-page',
    imports: [RouterLink, LegalLanguageNoticeComponent],
    templateUrl: './terms-page.component.html',
    styleUrl: '../../shared/styles/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsPageComponent {
    readonly business = BUSINESS;
}
