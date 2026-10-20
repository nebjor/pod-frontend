import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from './business';

/** Impressum: who runs the shop (Swiss UWG art. 3 para. 1 lit. s). */
@Component({
    selector: 'app-imprint',
    templateUrl: './imprint.component.html',
    styleUrl: './legal-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImprintComponent {
    readonly business = BUSINESS;
}
