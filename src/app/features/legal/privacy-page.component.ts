import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from '@core/config/business';
import { LegalLanguageNoticeComponent } from './legal-language-notice.component';

/** Datenschutzerklärung under the Swiss FADP; mirrors docs/data-protection.md in the backend repo. */
@Component({
    selector: 'app-privacy-page',
    imports: [LegalLanguageNoticeComponent],
    templateUrl: './privacy-page.component.html',
    styleUrl: '../../shared/styles/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPageComponent {
    readonly business = BUSINESS;
}
