import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from './business';

/** AGB: the contract the customer accepts at checkout. */
@Component({
    selector: 'app-terms',
    imports: [RouterLink],
    templateUrl: './terms.component.html',
    styleUrl: './legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsComponent {
    readonly business = BUSINESS;
}
