import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService } from '../account/account.service';
import { QualityCatalog } from '../quote/quality-catalog';
import { orderStatusLabel } from './order-status-labels';
import { OrderStatusTimelineComponent } from './order-status-timeline.component';
import { OrderResponse } from './order.models';
import { OrderService } from './order.service';

type LookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

/**
 * "Meine Bestellung": looks an order up by number and e-mail, the two things the order mail
 * carries. The mail links here with `?nr=&email=`, in which case the page looks the order up
 * right away and shows it alone; the lookup form is for a customer who arrives without the
 * link, for a failed lookup, and on request for another order.
 */
@Component({
    selector: 'app-order-status',
    imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, OrderStatusTimelineComponent],
    templateUrl: './order-status.component.html',
    styleUrls: ['../account/customer-page.scss', './order-status.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderStatusComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly orderService = inject(OrderService);
    private readonly account = inject(AccountService);
    private readonly qualityCatalog = inject(QualityCatalog);
    private readonly destroyRef = inject(DestroyRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly form = new FormGroup({
        orderNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] })
    });

    readonly state = signal<LookupState>('idle');
    readonly order = signal<OrderResponse | null>(null);
    readonly errorMessage = signal('');
    /** The customer asked for the form although an order is on screen ("Andere Bestellung anzeigen"). */
    readonly formRequested = signal(false);
    /** The form is for finding an order; once one is on screen it steps aside unless asked for. */
    readonly formVisible = computed(() => this.order() === null || this.formRequested());
    readonly statusLabel = computed(() => {
        const order = this.order();
        return order ? orderStatusLabel(order.status) : '';
    });
    /** Only a new order still waits for its payment; the backend hands out the link while it does. */
    readonly paymentUrl = computed(() => {
        const order = this.order();
        return order?.status === 'NEW' && order.paymentUrl ? order.paymentUrl : null;
    });
    /** A signed-in customer looking at one of their own orders gets the way to the account page. */
    readonly isOwnOrder = computed(() => {
        const order = this.order();
        const email = this.account.account()?.email;
        return !!order && !!email && this.account.isSignedIn() && order.customerEmail.toLowerCase() === email.toLowerCase();
    });

    constructor() {
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            const orderNumber = params.get('nr');
            const email = params.get('email');
            if (orderNumber) {
                this.form.controls.orderNumber.setValue(orderNumber);
            }
            if (email) {
                this.form.controls.email.setValue(email);
            }
            // The API is only asked in the browser; prerendering renders the empty form.
            if (orderNumber && email && this.isBrowser && this.state() === 'idle') {
                this.lookup();
            }
        });
        afterNextRender(() => this.qualityCatalog.load());
    }

    qualityLabel(code: string): string {
        return this.qualityCatalog.label(code);
    }

    /** Brings the form back next to the order on screen, with the number cleared for the next one. */
    showForm() {
        this.form.controls.orderNumber.setValue('');
        this.form.controls.orderNumber.markAsUntouched();
        this.formRequested.set(true);
    }

    lookup() {
        if (this.state() === 'loading') {
            return;
        }
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { orderNumber, email } = this.form.getRawValue();
        this.state.set('loading');
        this.errorMessage.set('');
        this.orderService
            .find(orderNumber.trim(), email.trim())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (order) => {
                    this.order.set(order);
                    this.formRequested.set(false);
                    this.state.set('found');
                },
                error: (error: unknown) => {
                    this.order.set(null);
                    if (error instanceof HttpErrorResponse && error.status === 404) {
                        this.state.set('not-found');
                    } else {
                        this.errorMessage.set(describeLookupError(error));
                        this.state.set('error');
                    }
                }
            });
    }
}

function describeLookupError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
            return 'Der Shop ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es noch einmal.';
        }
        if (error.status === 429) {
            return 'Zu viele Anfragen. Bitte warte einen Moment und probier es noch einmal.';
        }
    }
    return 'Die Bestellung konnte gerade nicht geladen werden. Bitte versuche es später noch einmal.';
}
