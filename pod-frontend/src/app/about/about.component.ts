import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from '../legal/business';

/** Who prints the parts and where: the story behind the shop, for customers and for search. */
@Component({
    selector: 'app-about',
    templateUrl: './about.component.html',
    styleUrl: '../legal/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutComponent {
    readonly business = BUSINESS;
}
