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

type LoginState = 'form' | 'sending' | 'sent' | 'redeeming' | 'invalid';

/**
 * How long a login link stays valid, as the page tells the customer. Mirrors the backend's
 * `account.login-link-minutes`; the API does not publish it.
 */
export const LOGIN_LINK_MINUTES = 15;

/**
 * Passwordless login. The page asks for the e-mail and the backend mails a link back here
 * with `?token=`; opening that link signs the customer in. `?returnTo=` (a path of this app)
 * says where to go afterwards, the account page otherwise.
 */
@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./customer-page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly account = inject(AccountService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly query = toSignal(
        this.route.queryParamMap.pipe(
            map((params) => ({ token: params.get('token') ?? '', returnTo: safeReturnPath(params.get('returnTo')) }))
        ),
        { initialValue: { token: '', returnTo: null } }
    );

    readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] })
    });
    readonly state = signal<LoginState>('form');
    readonly errorMessage = signal('');
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
                    this.state.set('invalid');
                }
            });
    }

    private continueAfterLogin() {
        const remembered = takeLoginReturnPath();
        void this.router.navigateByUrl(this.returnTo() ?? remembered ?? '/konto');
    }
}
