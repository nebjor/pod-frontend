import { DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Moving the cursor from the trigger into the panel may cross a gap; the panel waits this long. */
export const HOVER_MENU_CLOSE_DELAY_MS = 150;

/**
 * Open/close mechanics of a header dropdown: the host element wraps a trigger link and the
 * panel it opens. Hovering or focusing anything inside opens the panel; the panel closes once
 * the mouse has left for a grace period, when keyboard focus leaves the host, on Escape (which
 * hands the focus back to the trigger) and on any navigation, so the header stays on the next
 * page. The trigger stays a plain link: a tap on a touch device navigates as usual.
 *
 * Inside a panel with `role="menu"`, the arrow keys move the focus between the menu items.
 */
@Directive({
    selector: '[appHoverMenu]',
    exportAs: 'appHoverMenu',
    host: {
        '(mouseenter)': 'open()',
        '(mouseleave)': 'scheduleClose()',
        '(focusin)': 'open()',
        '(focusout)': 'onFocusOut($event)',
        '(keydown.escape)': 'onEscape()',
        '(keydown.arrowdown)': 'moveFocus(1, $event)',
        '(keydown.arrowup)': 'moveFocus(-1, $event)'
    }
})
export class HoverMenuDirective {
    /** The link that opens the panel; Escape returns the focus to it. */
    readonly trigger = input.required<HTMLElement>({ alias: 'appHoverMenu' });

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly openState = signal(false);
    private closeTimer: ReturnType<typeof setTimeout> | null = null;

    readonly isOpen = this.openState.asReadonly();

    constructor() {
        inject(Router)
            .events.pipe(
                filter((event) => event instanceof NavigationStart),
                takeUntilDestroyed()
            )
            .subscribe(() => this.close());
        inject(DestroyRef).onDestroy(() => this.cancelScheduledClose());
    }

    open() {
        this.cancelScheduledClose();
        this.openState.set(true);
    }

    close() {
        this.cancelScheduledClose();
        this.openState.set(false);
    }

    /** Mouse leaving the host; a cursor on its way into the panel gets a short grace period. */
    scheduleClose() {
        this.cancelScheduledClose();
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            this.openState.set(false);
        }, HOVER_MENU_CLOSE_DELAY_MS);
    }

    /** Keyboard focus moving out of the whole host closes the panel; moving within keeps it. */
    onFocusOut(event: FocusEvent) {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !this.host.nativeElement.contains(next)) {
            this.close();
        }
    }

    onEscape() {
        if (!this.openState()) {
            return;
        }
        // Focus first: focusing the trigger raises focusin, which would reopen a closed panel.
        this.trigger().focus();
        this.close();
    }

    moveFocus(step: 1 | -1, event: Event) {
        if (!this.openState()) {
            return;
        }
        const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        if (items.length === 0) {
            return;
        }
        event.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = current === -1 ? (step === 1 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
        items[next].focus();
    }

    private cancelScheduledClose() {
        if (this.closeTimer !== null) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    }
}
