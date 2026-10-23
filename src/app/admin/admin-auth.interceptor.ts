import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';

export const ADMIN_API_PREFIX = '/api/admin';

/** Adds the owner's credentials to admin calls and forgets them when the backend rejects them. */
export const adminAuthInterceptor: HttpInterceptorFn = (request, next) => {
    if (!request.url.startsWith(ADMIN_API_PREFIX)) {
        return next(request);
    }

    const auth = inject(AdminAuthService);
    const header = auth.authorizationHeader();
    const authorized = header ? request.clone({ setHeaders: { Authorization: header } }) : request;

    return next(authorized).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
                auth.logout();
            }
            return throwError(() => error);
        })
    );
};
