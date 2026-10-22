import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { orderStatusLabel } from '../order/order-status-labels';
import { FALLBACK_ORDER_SETTINGS, OrderResponse, OrderSettings } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { AccountResponse, LOGIN_PATH, PASSWORD_PATH } from './account.models';
import { AccountService, describeAccountError } from './account.service';

type PageState = 'loading' | 'ready' | 'deleted';
type OrdersState = 'loading' | 'ready' | 'error';

/**
 * "Mein Konto": the customer's orders, the saved delivery address, how the login works, logout
 * and deletion. Only for a signed-in customer; anyone else is sent to the login page once the
 * session is known.
 */
@Component({
    selector: 'app-account',
    imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
    templateUrl: './account.component.html',
    styleUrls: ['./customer-page.scss', './account.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountComponent {
    private readonly account = inject(AccountService);
    private readonly orderService = inject(OrderService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly customer = this.account.account;
    readonly hasPassword = computed(() => this.customer()?.hasPassword === true);
    readonly passwordPath = PASSWORD_PATH;
    readonly pageState = signal<PageState>('loading');
    readonly ordersState = signal<OrdersState>('loading');
    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);
    private readonly orderList = signal<OrderResponse[]>([]);
    /** Newest first, whatever order the backend chose. */
    readonly orders = computed(() => [...this.orderList()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

    readonly addressForm = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        street: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
        postalCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(16)] }),
        city: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
        country: new FormControl('CH', { nonNullable: true, validators: [Validators.required] })
    });
    readonly saving = signal(false);
    readonly saved = signal(false);
    readonly fieldErrors = signal<Record<string, string>>({});
    readonly errorMessage = signal('');

    readonly loggingOut = signal(false);
    readonly confirmingDelete = signal(false);
    readonly deleting = signal(false);
    readonly deleteError = signal('');

    constructor() {
        // The session is a cookie; only the browser can tell whether there is one.
        afterNextRender(() => this.start());
    }

    /** Waits for the session and either shows the page or sends the visitor to the login. */
    start() {
        void this.account.load().then(() => {
            const customer = this.customer();
            if (!customer) {
                this.toLogin();
                return;
            }
            this.fillForm(customer);
            this.pageState.set('ready');
            this.loadOrders();
            this.orderService
                .loadSettings()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (settings) => this.settings.set(settings),
                    error: () => {
                        // Keep the fallback: the country list only differs once the shop ships abroad.
                    }
                });
        });
    }

    loadOrders() {
        this.ordersState.set('loading');
        this.account
            .orders()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (orders) => {
                    this.orderList.set(orders);
                    this.ordersState.set('ready');
                },
                error: () => {
                    if (!this.account.isSignedIn()) {
                        this.toLogin();
                        return;
                    }
                    this.ordersState.set('error');
                }
            });
    }

    statusLabel(order: OrderResponse): string {
        return orderStatusLabel(order.status);
    }

    fieldError(field: string): string {
        return this.fieldErrors()[field] ?? '';
    }

    save() {
        if (this.saving()) {
            return;
        }
        if (this.addressForm.invalid) {
            this.addressForm.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.saved.set(false);
        this.errorMessage.set('');
        this.fieldErrors.set({});
        this.account
            .update(this.addressForm.getRawValue())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (customer) => {
                    this.fillForm(customer);
                    this.saving.set(false);
                    this.saved.set(true);
                },
                error: (error: unknown) => {
                    this.saving.set(false);
                    if (!this.account.isSignedIn()) {
                        this.toLogin();
                        return;
                    }
                    const failure = describeAccountError(error);
                    if (failure.kind === 'field-errors') {
                        this.fieldErrors.set(failure.errors);
                        this.errorMessage.set('Bitte pruefe die markierten Felder.');
                    } else {
                        this.errorMessage.set(failure.kind === 'error' ? failure.message : 'Die Adresse konnte nicht gespeichert werden.');
                    }
                }
            });
    }

    logout() {
        if (this.loggingOut()) {
            return;
        }
        this.loggingOut.set(true);
        this.account
            .logout()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => void this.router.navigateByUrl('/'),
                error: () => {
                    this.loggingOut.set(false);
                    this.errorMessage.set('Abmelden hat nicht geklappt. Bitte versuche es noch einmal.');
                }
            });
    }

    askDelete() {
        this.confirmingDelete.set(true);
        this.deleteError.set('');
    }

    cancelDelete() {
        this.confirmingDelete.set(false);
    }

    confirmDelete() {
        if (this.deleting()) {
            return;
        }
        this.deleting.set(true);
        this.deleteError.set('');
        this.account
            .deleteAccount()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.pageState.set('deleted'),
                error: (error: unknown) => {
                    this.deleting.set(false);
                    const failure = describeAccountError(error);
                    this.deleteError.set(
                        failure.kind === 'error'
                            ? failure.message
                            : 'Das Konto konnte gerade nicht geloescht werden. Bitte versuche es noch einmal.'
                    );
                }
            });
    }

    private fillForm(customer: AccountResponse) {
        this.addressForm.reset({
            name: customer.name ?? '',
            street: customer.street ?? '',
            postalCode: customer.postalCode ?? '',
            city: customer.city ?? '',
            country: customer.country ?? 'CH'
        });
    }

    private toLogin() {
        void this.router.navigateByUrl(LOGIN_PATH);
    }
}
