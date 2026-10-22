import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService } from '../cart/cart.service';
import { LOGIN_PATH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATH } from './account.models';
import { AccountService, describeAccountError, takeLoginReturnPath } from './account.service';

/** Both fields hold the same password; reported on the group, next to the second field. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value as string;
    const confirm = group.get('confirm')?.value as string;
    return confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * "Konto": sets, replaces or removes the password of a signed-in customer and deletes the
 * account. The link in the registration and "Passwort vergessen?" mails lands here. The account
 * shell sends anyone without a session to the login page, and they come back afterwards.
 *
 * A customer who arrives without a password (fresh registration) is on the way somewhere:
 * saving sends them on, to the path remembered when the mail was requested (the checkout),
 * else to the cart when it has items, else to the landing page. Changing an existing password
 * stays on the page, unless a remembered path is waiting.
 */
@Component({
    selector: 'app-password',
    imports: [ReactiveFormsModule],
    templateUrl: './password.component.html',
    styleUrls: ['./customer-page.scss', './password.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordComponent {
    private readonly account = inject(AccountService);
    private readonly cart = inject(CartService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly hasPassword = computed(() => this.account.account()?.hasPassword === true);
    readonly minLength = PASSWORD_MIN_LENGTH;

    readonly form = new FormGroup(
        {
            password: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(PASSWORD_MAX_LENGTH)]
            }),
            confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] })
        },
        { validators: passwordsMatch }
    );
    readonly saving = signal(false);
    readonly saved = signal(false);
    readonly fieldError = signal('');
    readonly errorMessage = signal('');

    readonly confirmingRemove = signal(false);
    readonly removing = signal(false);
    readonly removed = signal(false);
    readonly removeError = signal('');

    readonly confirmingDelete = signal(false);
    readonly deleting = signal(false);
    readonly deleteError = signal('');

    save() {
        if (this.saving()) {
            return;
        }
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const firstPassword = !this.hasPassword();
        this.saving.set(true);
        this.saved.set(false);
        this.removed.set(false);
        this.errorMessage.set('');
        this.fieldError.set('');
        this.account
            .setPassword(this.form.controls.password.value)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.form.reset();
                    this.saving.set(false);
                    const remembered = takeLoginReturnPath();
                    if (remembered) {
                        void this.router.navigateByUrl(remembered);
                    } else if (firstPassword) {
                        void this.router.navigateByUrl(this.cart.isEmpty() ? '/' : '/warenkorb');
                    } else {
                        this.saved.set(true);
                    }
                },
                error: (error: unknown) => {
                    this.saving.set(false);
                    if (!this.account.isSignedIn()) {
                        this.toLogin();
                        return;
                    }
                    const failure = describeAccountError(error);
                    if (failure.kind === 'field-errors') {
                        this.fieldError.set(failure.errors['password'] ?? '');
                        this.errorMessage.set('Bitte prüfe das Passwort.');
                    } else {
                        this.errorMessage.set(
                            failure.kind === 'error' ? failure.message : 'Das Passwort konnte nicht gespeichert werden.'
                        );
                    }
                }
            });
    }

    askRemove() {
        this.confirmingRemove.set(true);
        this.removeError.set('');
    }

    cancelRemove() {
        this.confirmingRemove.set(false);
    }

    confirmRemove() {
        if (this.removing()) {
            return;
        }
        this.removing.set(true);
        this.removeError.set('');
        this.account
            .removePassword()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.removing.set(false);
                    this.confirmingRemove.set(false);
                    this.saved.set(false);
                    this.removed.set(true);
                },
                error: (error: unknown) => {
                    this.removing.set(false);
                    if (!this.account.isSignedIn()) {
                        this.toLogin();
                        return;
                    }
                    const failure = describeAccountError(error);
                    this.removeError.set(
                        failure.kind === 'error'
                            ? failure.message
                            : 'Das Passwort konnte gerade nicht entfernt werden. Bitte versuche es noch einmal.'
                    );
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

    /** The shell shows the farewell card once the service reports the account as deleted. */
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
                error: (error: unknown) => {
                    this.deleting.set(false);
                    const failure = describeAccountError(error);
                    this.deleteError.set(
                        failure.kind === 'error'
                            ? failure.message
                            : 'Das Konto konnte gerade nicht gelöscht werden. Bitte versuche es noch einmal.'
                    );
                }
            });
    }

    private toLogin() {
        void this.router.navigate([LOGIN_PATH], { queryParams: { returnTo: PASSWORD_PATH } });
    }
}
