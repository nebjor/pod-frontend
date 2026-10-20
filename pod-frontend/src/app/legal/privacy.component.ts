import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from './business';

/** Datenschutzerklärung under the Swiss FADP; mirrors docs/data-protection.md in the backend repo. */
@Component({
    selector: 'app-privacy',
    templateUrl: './privacy.component.html',
    styleUrl: './legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyComponent {
    readonly business = BUSINESS;
}
