import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import {
    AccountService,
    describeAccountError,
    rememberLoginReturnPath,
    safeReturnPath,
    takeLoginReturnPath
} from './account.service';

type LoginState = 'form' | 'sending' | 'sent' | 'signingIn' | 'redeeming' | 'invalid';
/** The two ways in: the mail link (default) and the optional password. */
export type LoginMode = 'link' | 'password';

/**
 * How long a login link stays valid, as the page tells the customer. Mirrors the backend's
 * `account.login-link-minutes`; the API does not publish it.
 */
export const LOGIN_LINK_MINUTES = 15;

const EMAIL_VALIDATORS = [Validators.required, Validators.email, Validators.maxLength(254)];

/**
 * Login page. By default the page asks for the e-mail and the backend mails a link back here
 * with `?token=`; opening that link signs the customer in. A customer who set a password can
 * switch to e-mail and password instead. `?returnTo=` (a path of this app) says where to go
 * afterwards, as does `?next=` on the links in the mail; the account page otherwise.
 */
@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./customer-page.scss', './login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly account = inject(AccountService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly query = toSignal(
        this.route.queryParamMap.pipe(
            map((params) => ({
                token: params.get('token') ?? '',
                returnTo: safeReturnPath(params.get('returnTo')),
                next: safeReturnPath(params.get('next'))
            }))
        ),
        { initialValue: { token: '', returnTo: null, next: null } }
    );

    readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: EMAIL_VALIDATORS })
    });
    readonly passwordForm = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: EMAIL_VALIDATORS }),
        password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });
    readonly mode = signal<LoginMode>('link');
    readonly state = signal<LoginState>('form');
    readonly errorMessage = signal('');
    readonly passwordError = signal('');
    readonly sentTo = signal('');
    readonly linkMinutes = LOGIN_LINK_MINUTES;
    readonly returnTo = computed(() => this.query().returnTo);

    constructor() {
        // Cookies and the token in the URL exist in the browser only; the route is prerendered too.
        afterNextRender(() => this.start());
    }

    /** Redeems the token from the mail, or skips the page for a customer who is signed in already. */
    start() {
        const { token } = this.query();
        if (token) {
            this.redeem(token);
            return;
        }
        void this.account.load().then(() => {
            if (this.account.isSignedIn()) {
                this.continueAfterLogin();
            }
        });
    }

    /** Switches between link and password; the e-mail typed so far moves along. */
    switchMode(mode: LoginMode) {
        if (mode === this.mode()) {
            return;
        }
        const from = mode === 'password' ? this.form : this.passwordForm;
        const to = mode === 'password' ? this.passwordForm : this.form;
        if (from.controls.email.value) {
            to.controls.email.setValue(from.controls.email.value);
        }
        this.mode.set(mode);
        this.errorMessage.set('');
        this.passwordError.set('');
    }

    submit() {
        if (this.state() === 'sending') {
            return;
        }
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const email = this.form.controls.email.value.trim();
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
                    this.state.set('sent');
                },
                error: (error: unknown) => {
                    const failure = describeAccountError(error);
                    this.errorMessage.set(
                        failure.kind === 'error'
                            ? failure.message
                            : 'Der Link konnte nicht verschickt werden. Bitte versuche es noch einmal.'
                    );
                    this.state.set('form');
                }
            });
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
                    const failure = describeAccountError(error);
                    if (failure.kind === 'invalid-credentials') {
                        this.passwordError.set('E-Mail oder Passwort stimmt nicht.');
                    } else if (failure.kind === 'error') {
                        this.passwordError.set(failure.message);
                    } else {
                        this.passwordError.set('Die Anmeldung hat nicht geklappt. Bitte versuche es noch einmal.');
                    }
                    this.passwordForm.controls.password.reset();
                    this.state.set('form');
                }
            });
    }

    /** Back to the form, to ask for another link. */
    reset() {
        this.state.set('form');
        this.errorMessage.set('');
    }

    private redeem(token: string) {
        this.state.set('redeeming');
        this.account
            .redeemToken(token)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.continueAfterLogin(),
                error: (error: unknown) => {
                    const failure = describeAccountError(error);
                    this.errorMessage.set(
                        failure.kind === 'error'
                            ? failure.message
                            : 'Dieser Anmeldelink ist ungueltig, abgelaufen oder schon benutzt. Fordere unten einen neuen an.'
                    );
                    this.mode.set('link');
                    this.state.set('invalid');
                }
            });
    }

    /**
     * `returnTo` on the page wins, then `next` from the link in the mail, then the path the
     * checkout left behind when the link was requested.
     */
    private continueAfterLogin() {
        const { returnTo, next } = this.query();
        const remembered = takeLoginReturnPath();
        void this.router.navigateByUrl(returnTo ?? next ?? remembered ?? '/konto');
    }
}
