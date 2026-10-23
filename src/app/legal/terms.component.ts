import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from './business';
import { LegalLanguageNoticeComponent } from './legal-language-notice.component';

/** AGB: the contract the customer accepts at checkout. */
@Component({
    selector: 'app-terms',
    imports: [RouterLink, LegalLanguageNoticeComponent],
    templateUrl: './terms.component.html',
    styleUrl: './legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsComponent {
    readonly business = BUSINESS;
}
