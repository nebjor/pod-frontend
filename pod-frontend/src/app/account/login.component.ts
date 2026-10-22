import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import {
    AccountService,
    describeAccountError,
    rememberLoginReturnPath,
    safeReturnPath,
    takeLoginReturnPath
} from './account.service';

/**
 * `sent` is the mailbox hint after a registration, `resetSent` the one after "Passwort
 * vergessen?"; both mails carry the same kind of link.
 */
type LoginState = 'form' | 'sending' | 'sent' | 'resetSent' | 'signingIn' | 'redeeming' | 'invalid';
/** The two faces of the page: sign in with the password (default) or register by e-mail. */
export type LoginMode = 'password' | 'register';

/**
 * How long a login link stays valid, as the page tells the customer. Mirrors the backend's
 * `account.login-link-minutes`; the API does not publish it.
 */
export const LOGIN_LINK_MINUTES = 15;

const EMAIL_VALIDATORS = [Validators.required, Validators.email, Validators.maxLength(254)];

/**
 * Login page. By default it asks for e-mail and password. "Registrieren" (also reached with
 * `?mode=register`) and "Passwort vergessen?" both ask the backend for a mail whose link comes
 * back here with `?token=` and `?next=/konto/passwort`: opening it signs the customer in and
 * lands on the password page. `?returnTo=` (a path of this app) says where to go afterwards;
 * the account page otherwise.
 */
@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, TranslatePipe],
    templateUrl: './login.component.html',
    styleUrls: ['./customer-page.scss', './login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly account = inject(AccountService);
    private readonly i18n = inject(I18nService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly query = toSignal(
        this.route.queryParamMap.pipe(
            map((params) => ({
                token: params.get('token') ?? '',
                mode: (params.get('mode') === 'register' ? 'register' : 'password') as LoginMode,
                returnTo: safeReturnPath(params.get('returnTo')),
                next: safeReturnPath(params.get('next'))
            }))
        ),
        { initialValue: { token: '', mode: 'password' as LoginMode, returnTo: null, next: null } }
    );

    readonly passwordForm = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: EMAIL_VALIDATORS }),
        password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });
    readonly registerForm = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: EMAIL_VALIDATORS })
    });
    readonly mode = signal<LoginMode>('password');
    readonly state = signal<LoginState>('form');
    readonly errorMessage = signal('');
    readonly passwordError = signal('');
    readonly sentTo = signal('');
    readonly linkMinutes = LOGIN_LINK_MINUTES;
    readonly returnTo = computed(() => this.query().returnTo);

    constructor() {
        // Cookies and the query exist in the browser only; the route is prerendered too.
        afterNextRender(() => this.start());
    }

    /** Redeems the token from the mail, or skips the page for a customer who is signed in already. */
    start() {
        const { token, mode } = this.query();
        if (token) {
            this.redeem(token);
            return;
        }
        this.mode.set(mode);
        void this.account.load().then(() => {
            if (this.account.isSignedIn()) {
                this.continueAfterLogin();
            }
        });
    }

    /** Switches between sign-in and registration; the e-mail typed so far moves along. */
    switchMode(mode: LoginMode) {
        if (mode === this.mode()) {
            return;
        }
        const from = mode === 'register' ? this.passwordForm : this.registerForm;
        const to = mode === 'register' ? this.registerForm : this.passwordForm;
        if (from.controls.email.value) {
            to.controls.email.setValue(from.controls.email.value);
        }
        this.mode.set(mode);
        this.errorMessage.set('');
        this.passwordError.set('');
    }

    submitPassword() {
        if (this.state() === 'signingIn') {
            return;
        }
        if (this.passwordForm.invalid) {
            this.passwordForm.markAllAsTouched();
            return;
        }

        const { email, password } = this.passwordForm.getRawValue();
        this.state.set('signingIn');
        this.passwordError.set('');
        this.account
            .loginWithPassword(email.trim(), password)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.continueAfterLogin(),
                error: (error: unknown) => {
                    const failure = describeAccountError(error, this.i18n.t);
                    if (failure.kind === 'invalid-credentials') {
                        this.passwordError.set(this.i18n.t('login.error.credentials'));
                    } else if (failure.kind === 'error') {
                        this.passwordError.set(failure.message);
                    } else {
                        this.passwordError.set(this.i18n.t('login.error.signIn'));
                    }
                    this.passwordForm.controls.password.reset();
                    this.state.set('form');
                }
            });
    }

    /** "Registrieren": mails the link that sets the password; needs only the e-mail. */
    submitRegister() {
        if (this.registerForm.invalid) {
            this.registerForm.markAllAsTouched();
            return;
        }
        this.sendLink(this.registerForm.controls.email, 'sent');
    }

    /** "Passwort vergessen?": the same mail, for the e-mail typed into the sign-in form. */
    forgotPassword() {
        const email = this.passwordForm.controls.email;
        if (email.invalid) {
            email.markAsTouched();
            return;
        }
        this.passwordError.set('');
        this.sendLink(email, 'resetSent');
    }

    /** Back to the form, to ask for another mail. */
    reset() {
        this.state.set('form');
        this.errorMessage.set('');
    }

    /** From the mailbox hint back to the sign-in form, for customers who already have a password. */
    backToLogin() {
        this.reset();
        this.switchMode('password');
    }

    private sendLink(control: FormControl<string>, sentState: 'sent' | 'resetSent') {
        if (this.state() === 'sending') {
            return;
        }
        const email = control.value.trim();
        this.state.set('sending');
        this.errorMessage.set('');
        // The mail link carries the token only; keep the way back for when it is opened.
        rememberLoginReturnPath(this.returnTo());
        this.account
            .requestLoginLink(email)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.sentTo.set(email);
                    this.state.set(sentState);
                },
                error: (error: unknown) => {
                    const failure = describeAccountError(error, this.i18n.t);
                    this.errorMessage.set(failure.kind === 'error' ? failure.message : this.i18n.t('login.error.send'));
                    this.state.set('form');
                }
            });
    }

    private redeem(token: string) {
        this.state.set('redeeming');
        this.account
            .redeemToken(token)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.continueAfterLogin(),
                error: (error: unknown) => {
                    const failure = describeAccountError(error, this.i18n.t);
                    this.errorMessage.set(failure.kind === 'error' ? failure.message : this.i18n.t('login.error.token'));
                    this.mode.set('register');
                    this.state.set('invalid');
                }
            });
    }

    /**
     * `returnTo` on the page wins, then `next` from the link in the mail, then the path the
     * checkout left behind when the mail was requested. When `next` wins, the remembered path
     * stays put: the password page the mail links to picks it up once the password is saved.
     */
    private continueAfterLogin() {
        const { returnTo, next } = this.query();
        if (returnTo) {
            takeLoginReturnPath();
            void this.router.navigateByUrl(returnTo);
            return;
        }
        void this.router.navigateByUrl(next ?? takeLoginReturnPath() ?? '/konto');
    }
}
