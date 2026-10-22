import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { I18nService, LANGS, Lang } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Header control that switches the shop's language. A button shows the active flag and code;
 * a click opens a list with the four languages by their own names. The list closes on a
 * choice, on Escape (focus returns to the button), on a click elsewhere and when keyboard
 * focus leaves the control. The flags are inline SVG: flag emoji do not render on Windows.
 */
@Component({
    selector: 'app-language-switcher',
    imports: [NgTemplateOutlet, TranslatePipe],
    templateUrl: './language-switcher.component.html',
    styleUrl: './language-switcher.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)',
        '(keydown.escape)': 'onEscape()',
        '(focusout)': 'onFocusOut($event)'
    }
})
export class LanguageSwitcherComponent {
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
    protected readonly i18n = inject(I18nService);

    readonly options = LANGS.map((lang) => ({ lang, nameKey: `lang.${lang}` as const }));
    readonly currentNameKey = computed(() => `lang.${this.i18n.lang()}` as const);
    readonly currentCode = computed(() => this.i18n.lang().toUpperCase());
    readonly isOpen = signal(false);

    toggle() {
        this.isOpen.update((open) => !open);
    }

    choose(lang: Lang) {
        // The button changes once the dictionary is there; the list closes at once.
        void this.i18n.setLang(lang);
        this.isOpen.set(false);
        this.trigger().nativeElement.focus();
    }

    onEscape() {
        if (!this.isOpen()) {
            return;
        }
        this.isOpen.set(false);
        this.trigger().nativeElement.focus();
    }

    onDocumentClick(event: Event) {
        if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
            this.isOpen.set(false);
        }
    }

    onFocusOut(event: FocusEvent) {
        const next = event.relatedTarget;
        if (this.isOpen() && next instanceof Node && !this.host.nativeElement.contains(next)) {
            this.isOpen.set(false);
        }
    }
}
