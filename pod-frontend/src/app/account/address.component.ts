import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { FALLBACK_ORDER_SETTINGS, OrderSettings } from '../order/order.models';
import { OrderService } from '../order/order.service';
import { AccountResponse, LOGIN_PATH } from './account.models';
import { AccountService, describeAccountError } from './account.service';

/**
 * "Lieferadresse": the address that is prefilled in the checkout. Rendered inside the account
 * shell, which has already made sure there is a session.
 */
@Component({
    selector: 'app-address',
    imports: [ReactiveFormsModule, TranslatePipe],
    templateUrl: './address.component.html',
    styleUrls: ['./customer-page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddressComponent {
    private readonly account = inject(AccountService);
    private readonly orderService = inject(OrderService);
    private readonly router = inject(Router);
    private readonly i18n = inject(I18nService);
    private readonly destroyRef = inject(DestroyRef);

    readonly settings = signal<OrderSettings>(FALLBACK_ORDER_SETTINGS);

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

    constructor() {
        const customer = this.account.account();
        if (customer) {
            this.fillForm(customer);
        }
        this.orderService
            .loadSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => this.settings.set(settings),
                error: () => {
                    // Keep the fallback: the country list only differs once the shop ships abroad.
                }
            });
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
                        void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo: '/konto/adresse' } });
                        return;
                    }
                    const failure = describeAccountError(error, this.i18n.t);
                    if (failure.kind === 'field-errors') {
                        this.fieldErrors.set(failure.errors);
                        this.errorMessage.set(this.i18n.t('common.fieldsCheck'));
                    } else {
                        this.errorMessage.set(failure.kind === 'error' ? failure.message : this.i18n.t('address.error.save'));
                    }
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
}
