import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { ORDER_STATUS_STEPS, orderStatusLabel } from '@core/order/order-status-labels';
import { OrderStatus } from '@core/order/order.models';

/**
 * Horizontal steps from "new" to "shipped" with the reached ones filled and the current
 * one highlighted. A cancelled order shows a single "cancelled" marker instead of the steps.
 */
@Component({
    selector: 'app-order-status-timeline',
    imports: [TranslatePipe],
    template: `
        @if (status() === 'CANCELLED') {
            <p class="cancelled" role="status">{{ 'orderStatus.CANCELLED' | t }}</p>
        } @else {
            <ol class="steps" [attr.aria-label]="'orderStatus.aria' | t:{ status: currentLabel() }">
                @for (step of steps; track step; let index = $index) {
                    <li class="step" [class.done]="index < currentIndex()" [class.current]="index === currentIndex()"
                        [attr.aria-current]="index === currentIndex() ? 'step' : null">
                        <span class="dot" aria-hidden="true"></span>
                        <span class="label">{{ label(step) }}</span>
                    </li>
                }
            </ol>
        }
    `,
    styles: `
        :host {
            display: block;
        }

        .steps {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .step {
            position: relative;
            display: grid;
            justify-items: center;
            gap: 0.4rem;
            text-align: center;
            font-size: 0.72rem;
            color: var(--text-300);

            &::before {
                content: '';
                position: absolute;
                top: 7px;
                left: -50%;
                width: 100%;
                height: 2px;
                background: var(--border-650);
            }

            &:first-child::before {
                display: none;
            }

            &.done::before,
            &.current::before {
                background: var(--accent-500);
            }

            &.done,
            &.current {
                color: var(--text-100);
            }

            &.current .label {
                color: var(--accent-300);
                font-weight: 700;
            }
        }

        .dot {
            position: relative;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid var(--border-650);
            background: #0d2232;
            box-sizing: border-box;
        }

        .done .dot {
            border-color: var(--accent-500);
            background: var(--accent-500);
        }

        .current .dot {
            border-color: var(--accent-300);
            background: var(--accent-300);
            box-shadow: 0 0 0 4px rgba(140, 200, 179, 0.25);
        }

        .label {
            line-height: 1.3;
            overflow-wrap: anywhere;
        }

        .cancelled {
            margin: 0;
            display: inline-block;
            padding: 0.4rem 0.8rem;
            border-radius: 999px;
            border: 1px solid #d99898;
            color: #d99898;
            font-size: 0.85rem;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderStatusTimelineComponent {
    private readonly i18n = inject(I18nService);

    readonly status = input.required<OrderStatus>();
    readonly steps = ORDER_STATUS_STEPS;
    readonly currentIndex = computed(() => this.steps.indexOf(this.status()));
    readonly currentLabel = computed(() => orderStatusLabel(this.status(), this.i18n.t));

    label(step: OrderStatus): string {
        return orderStatusLabel(step, this.i18n.t);
    }
}
