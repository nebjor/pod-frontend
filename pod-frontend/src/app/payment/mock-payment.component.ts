import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { OrderService, describeOrderError } from '../order/order.service';

/**
 * Stand-in for the provider's hosted payment page while the Stripe account is pending. It
 * takes the same role: the customer arrives by redirect, pays or cancels, and is sent back.
 * Confirmation goes through the backend, never through the client alone.
 */
@Component({
    selector: 'app-mock-payment',
    imports: [DecimalPipe],
    templateUrl: './mock-payment.component.html',
    styleUrl: './mock-payment.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MockPaymentComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly orderService = inject(OrderService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly query = toSignal(this.route.queryParamMap.pipe(map((params) => ({
        session: params.get('session') ?? '',
        order: params.get('order') ?? '',
        amount: Number(params.get('amount') ?? '0'),
        currency: params.get('currency') ?? 'CHF'
    }))), { initialValue: { session: '', order: '', amount: 0, currency: 'CHF' } });

    readonly session = computed(() => this.query().session);
    readonly orderNumber = computed(() => this.query().order);
    readonly amount = computed(() => this.query().amount);
    readonly currency = computed(() => this.query().currency);
    readonly paying = signal(false);
    readonly errorMessage = signal('');

    pay() {
        if (this.paying() || !this.session()) {
            return;
        }
        this.paying.set(true);
        this.errorMessage.set('');

        this.orderService
            .completeMockPayment(this.session())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    void this.router.navigate(['/checkout/success'], { queryParams: { order: result.orderNumber } });
                },
                error: (error: unknown) => {
                    this.paying.set(false);
                    const failure = describeOrderError(error);
                    this.errorMessage.set(failure.kind === 'error' ? failure.message : 'Die Zahlung konnte nicht bestaetigt werden.');
                }
            });
    }

    cancel() {
        void this.router.navigate(['/checkout/success'], { queryParams: { order: this.orderNumber(), cancelled: 1 } });
    }
}
