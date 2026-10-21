import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrderStatus } from '../order/order.models';
import { describeQuoteError } from '../quote/quote.service';
import { formatPrintDuration } from '../quote/print-duration';
import { AdminApiService, AdminOrder } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';

/** Owner-facing labels for each state and for the button that moves an order into it. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
    NEW: 'Neu, unbezahlt',
    PAID: 'Bezahlt',
    IN_REVIEW: 'In Pruefung',
    APPROVED: 'Freigegeben',
    PRINTING: 'Im Druck',
    SHIPPED: 'Versendet',
    CANCELLED: 'Storniert'
};

export const TRANSITION_LABELS: Record<OrderStatus, string> = {
    NEW: 'Zurueck auf neu',
    PAID: 'Als bezahlt markieren',
    IN_REVIEW: 'Pruefung starten',
    APPROVED: 'Freigeben',
    PRINTING: 'Druck starten',
    SHIPPED: 'Als versendet markieren',
    CANCELLED: 'Stornieren'
};

type ListState = 'checking' | 'login' | 'loading' | 'ready' | 'error';

@Component({
    selector: 'app-admin',
    imports: [ReactiveFormsModule, DecimalPipe, DatePipe],
    templateUrl: './admin.component.html',
    styleUrl: './admin.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent {
    private readonly api = inject(AdminApiService);
    private readonly auth = inject(AdminAuthService);
    private readonly destroyRef = inject(DestroyRef);

    readonly statusLabels = STATUS_LABELS;
    readonly transitionLabels = TRANSITION_LABELS;
    readonly statusOptions: OrderStatus[] = ['NEW', 'PAID', 'IN_REVIEW', 'APPROVED', 'PRINTING', 'SHIPPED', 'CANCELLED'];

    readonly state = signal<ListState>('checking');
    readonly orders = signal<AdminOrder[]>([]);
    readonly filter = signal<OrderStatus | ''>('');
    readonly selectedNumber = signal<string | null>(null);
    readonly errorMessage = signal('');
    readonly notice = signal('');
    readonly busy = signal(false);

    readonly selected = computed(() => this.orders().find((order) => order.orderNumber === this.selectedNumber()) ?? null);
    readonly selectedPrintTime = computed(() => formatPrintDuration(this.selected()?.totalPrintTimeSeconds ?? 0));

    readonly loginForm = new FormGroup({
        username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });

    constructor() {
        afterNextRender(() => {
            this.auth.restore();
            if (this.auth.loggedIn()) {
                this.load();
            } else {
                this.state.set('login');
            }
        });
    }

    login() {
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }
        const { username, password } = this.loginForm.getRawValue();
        this.auth.login(username, password);
        this.load();
    }

    logout() {
        this.auth.logout();
        this.orders.set([]);
        this.selectedNumber.set(null);
        this.state.set('login');
    }

    setFilter(value: string) {
        this.filter.set(value as OrderStatus | '');
        this.load();
    }

    select(orderNumber: string) {
        this.selectedNumber.set(this.selectedNumber() === orderNumber ? null : orderNumber);
    }

    load() {
        this.state.set('loading');
        this.errorMessage.set('');
        this.api
            .listOrders(this.filter() || undefined)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (orders) => {
                    this.orders.set(orders);
                    this.state.set('ready');
                },
                error: (error: unknown) => this.fail(error)
            });
    }

    transition(order: AdminOrder, status: OrderStatus) {
        if (this.busy()) {
            return;
        }
        this.busy.set(true);
        this.notice.set('');
        this.api
            .setStatus(order.orderNumber, status)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.orders.update((list) => list.map((item) => (item.orderNumber === updated.orderNumber ? updated : item)));
                    this.notice.set(`${updated.orderNumber}: ${STATUS_LABELS[updated.status]}`);
                    this.busy.set(false);
                },
                error: (error: unknown) => {
                    this.busy.set(false);
                    this.errorMessage.set(describeQuoteError(error));
                }
            });
    }

    download(order: AdminOrder) {
        this.api
            .downloadModel(order.orderNumber)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => saveBlob(blob, `${order.orderNumber}_${order.fileName}`),
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    resetRateLimits() {
        this.api
            .resetRateLimits()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.notice.set('Rate-Limits zurueckgesetzt.'),
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    private fail(error: unknown) {
        if (!this.auth.loggedIn()) {
            // The interceptor dropped rejected credentials.
            this.state.set('login');
            this.errorMessage.set('Anmeldung fehlgeschlagen. Bitte Zugangsdaten pruefen.');
            return;
        }
        this.state.set('error');
        this.errorMessage.set(describeQuoteError(error));
    }
}

/** Triggers a browser download for a blob; no-op outside the browser. */
export function saveBlob(blob: Blob, fileName: string) {
    if (typeof document === 'undefined') {
        return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
