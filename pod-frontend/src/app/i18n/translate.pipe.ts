import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationKey } from './de';
import { I18nService, TranslateParams } from './i18n.service';

/**
 * `{{ 'header.account' | t }}` and `{{ 'cart.printTime' | t: { time: label } }}`. The language
 * signal is read inside `transform`, which registers it with the template's reactive context.
 *
 * The pipe is deliberately impure: a pure pipe is skipped while its arguments are unchanged,
 * so a language switch would never reach it. The work per call is one dictionary lookup.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
    private readonly i18n = inject(I18nService);

    transform(key: TranslationKey, params?: TranslateParams): string {
        return this.i18n.t(key, params);
    }
}
