import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService, LANG_STORAGE_KEY } from '../i18n/i18n.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

describe('LanguageSwitcherComponent', () => {
    let fixture: ComponentFixture<LanguageSwitcherComponent>;
    let root: HTMLElement;

    beforeEach(async () => {
        localStorage.clear();
        await TestBed.configureTestingModule({ imports: [LanguageSwitcherComponent] }).compileComponents();
        fixture = TestBed.createComponent(LanguageSwitcherComponent);
        root = fixture.nativeElement as HTMLElement;
        await fixture.whenStable();
    });

    afterEach(() => localStorage.clear());

    const trigger = () => root.querySelector<HTMLButtonElement>('button.trigger')!;
    const options = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="option"]'));

    async function open() {
        trigger().click();
        await fixture.whenStable();
    }

    it('shows the German flag and code first, with the list closed', () => {
        expect(trigger().textContent).toContain('DE');
        expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
        expect(trigger().querySelector('svg.flag')?.getAttribute('aria-hidden')).toBe('true');
        expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('opens a list with the four languages by their own names', async () => {
        await open();

        expect(trigger().getAttribute('aria-expanded')).toBe('true');
        expect(root.querySelector('[role="listbox"]')).not.toBeNull();
        expect(options().map((option) => option.textContent?.trim())).toEqual(['Deutsch', 'Français', 'Italiano', 'English']);
        expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
        expect(options().every((option) => option.querySelector('svg.flag[aria-hidden="true"]') !== null)).toBe(true);
    });

    it('closes after a choice and shows the new flag and code', async () => {
        await open();

        options()[1].click();
        await fixture.whenStable();

        expect(root.querySelector('[role="listbox"]')).toBeNull();
        expect(trigger().textContent).toContain('FR');
        expect(TestBed.inject(I18nService).lang()).toBe('fr');
        expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('fr');
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('marks the chosen language as selected when the list is opened again', async () => {
        await open();
        options()[3].click();
        await fixture.whenStable();

        await open();

        expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'true']);
        expect(trigger().textContent).toContain('EN');
    });

    it('closes on Escape and hands the focus back to the button', async () => {
        document.body.appendChild(root);
        await open();
        options()[0].focus();

        options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await fixture.whenStable();

        expect(root.querySelector('[role="listbox"]')).toBeNull();
        expect(document.activeElement).toBe(trigger());
        root.remove();
    });

    it('closes on a click anywhere else', async () => {
        await open();

        document.body.click();
        await fixture.whenStable();

        expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('toggles shut when the button is clicked again', async () => {
        await open();

        trigger().click();
        await fixture.whenStable();

        expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('names itself and the current language for screen readers', async () => {
        expect(trigger().getAttribute('aria-label')).toBe('Sprache: Deutsch');

        await open();
        options()[2].click();
        await fixture.whenStable();

        expect(trigger().getAttribute('aria-label')).toBe('Lingua: Italiano');
    });
});
