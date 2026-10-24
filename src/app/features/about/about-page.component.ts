import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { BUSINESS } from '@core/config/business';

/** Who prints the parts and where: the story behind the shop, for customers and for search. */
@Component({
    selector: 'app-about-page',
    imports: [TranslatePipe],
    templateUrl: './about-page.component.html',
    styleUrl: '../../shared/styles/legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutPageComponent {
    readonly business = BUSINESS;
}
