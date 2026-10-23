import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { BUSINESS } from '@core/config/business';

@Component({
    selector: 'app-footer',
    imports: [RouterLink, TranslatePipe],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {
    readonly business = BUSINESS;
    readonly year = new Date().getFullYear();
}
