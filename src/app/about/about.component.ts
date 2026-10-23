import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BUSINESS } from '../legal/business';

/** Who prints the parts and where: the story behind the shop, for customers and for search. */
@Component({
    selector: 'app-about',
    imports: [TranslatePipe],
    templateUrl: './about.component.html',
    styleUrl: '../legal/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutComponent {
    readonly business = BUSINESS;
}
