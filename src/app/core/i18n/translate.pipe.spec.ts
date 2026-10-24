import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
    selector: 'app-pipe-host',
    imports: [TranslatePipe],
    template: `
        <p class="plain">{{ 'cart.empty' | t }}</p>
        <p class="params">{{ 'common.pieces' | t: { count: count() } }}</p>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
class PipeHostComponent {
    readonly count = signal(2);
}

describe('TranslatePipe', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    function text(root: HTMLElement, selector: string): string {
        return root.querySelector(selector)?.textContent?.trim() ?? '';
    }

    it('renders the active language and fills the parameters', async () => {
        const fixture = TestBed.createComponent(PipeHostComponent);
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;

        expect(text(root, '.plain')).toBe('Dein Warenkorb ist leer.');
        expect(text(root, '.params')).toBe('2 Stück');
    });

    it('re-renders an OnPush template when the language changes', async () => {
        const fixture = TestBed.createComponent(PipeHostComponent);
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;
        const i18n = TestBed.inject(I18nService);

        await i18n.setLang('fr');
        await fixture.whenStable();
        expect(text(root, '.plain')).toBe('Votre panier est vide.');
        expect(text(root, '.params')).toBe('2 pce');

        await i18n.setLang('en');
        await fixture.whenStable();
        expect(text(root, '.plain')).toBe('Your cart is empty.');
        expect(text(root, '.params')).toBe('2 pcs');

        await i18n.setLang('de');
        await fixture.whenStable();
        expect(text(root, '.plain')).toBe('Dein Warenkorb ist leer.');
    });

    it('keeps following the parameters', async () => {
        const fixture = TestBed.createComponent(PipeHostComponent);
        await fixture.whenStable();

        fixture.componentInstance.count.set(5);
        await fixture.whenStable();

        expect(text(fixture.nativeElement as HTMLElement, '.params')).toBe('5 Stück');
    });
});
