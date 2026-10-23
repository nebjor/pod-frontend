import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from '@core/config/business';
import { LegalLanguageNoticeComponent } from './legal-language-notice.component';

/** Impressum: who runs the shop (Swiss UWG art. 3 para. 1 lit. s). */
@Component({
    selector: 'app-imprint-page',
    imports: [LegalLanguageNoticeComponent],
    templateUrl: './imprint-page.component.html',
    styleUrl: '../../shared/styles/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImprintPageComponent {
    readonly business = BUSINESS;
}
