import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { Translate, translateDe } from '../i18n/i18n.service';
import { QuoteOptions, QuoteRequestParams, QuoteResponse, UploadedModel } from './quote.models';

/** Relative paths; the dev server proxies `/api` to the Spring backend (see proxy.conf.js). */
export const QUOTE_API_URL = '/api/quotes';
export const MODEL_API_URL = '/api/models';

/** What an upload reports: progress while the bytes go out, then the model the backend keeps. */
export type UploadEvent = { kind: 'progress'; percent: number } | { kind: 'done'; model: UploadedModel };

@Injectable({ providedIn: 'root' })
export class QuoteService {
    private readonly http = inject(HttpClient);

    /**
     * Uploads the model once; the backend keeps it for a while so that quotes reference it by
     * id instead of sending the file again.
     */
    uploadModel(file: File): Observable<UploadEvent> {
        const body = new FormData();
        body.append('file', file, file.name);

        return this.http.post<UploadedModel>(MODEL_API_URL, body, { reportProgress: true, observe: 'events' }).pipe(
            map((event): UploadEvent | null => {
                if (event.type === HttpEventType.UploadProgress) {
                    const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
                    return { kind: 'progress', percent };
                }
                if (event.type === HttpEventType.Response && event.body) {
                    return { kind: 'done', model: event.body };
                }
                return null;
            }),
            filter((event): event is UploadEvent => event !== null)
        );
    }

    /** Lets the backend slice and price a model it already keeps. */
    requestQuote(modelId: string, params: QuoteRequestParams): Observable<QuoteResponse> {
        const body = new FormData();
        body.append('modelId', modelId);
        body.append('filament', params.filament);
        body.append('color', params.color);
        body.append('quality', params.quality);
        body.append('quantity', String(params.quantity));

        return this.http.post<QuoteResponse>(QUOTE_API_URL, body);
    }

    /** Filaments, qualities and limits the backend currently accepts. */
    loadOptions(): Observable<QuoteOptions> {
        return this.http.get<QuoteOptions>(`${QUOTE_API_URL}/options`);
    }
}

/** Shape of the RFC 9457 problem details the backend returns. */
interface QuoteProblem {
    detail?: unknown;
    retryAfterSeconds?: unknown;
    supportEmail?: unknown;
}

/** True when the backend no longer keeps the model and it has to be uploaded again. */
export function isModelExpired(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
        return false;
    }
    const problem = (error.error ?? null) as { code?: unknown } | null;
    return problem?.code === 'model-expired';
}

/**
 * Turns an HTTP failure into a message the customer can act on. The backend words its problem
 * details for the customer and they are shown as they are; a failure without one gets a short
 * line without status codes. `t` words the lines of this app in the active language; without
 * it they are German (the admin area, which stays German, calls it that way).
 */
export function describeQuoteError(error: unknown, t: Translate = translateDe): string {
    if (error instanceof HttpErrorResponse) {
        const problem = (error.error ?? null) as QuoteProblem | null;

        if (error.status === 0) {
            return t('error.unreachable');
        }
        if (error.status === 413) {
            return t('error.tooLarge');
        }
        if (error.status === 429) {
            return t('error.rateLimit', { retry: formatRetry(problem?.retryAfterSeconds, t) }) + supportHint(problem?.supportEmail, t);
        }
        if (error.status === 503) {
            return t('error.busy', { retry: formatRetry(problem?.retryAfterSeconds, t) });
        }

        const detail = problem?.detail;
        if (typeof detail === 'string' && detail.length > 0) {
            return detail;
        }
    }

    return t('error.quote');
}

function formatRetry(retryAfterSeconds: unknown, t: Translate): string {
    const seconds = typeof retryAfterSeconds === 'number' ? Math.ceil(retryAfterSeconds) : 0;
    if (seconds <= 0) {
        return t('error.retryLater');
    }
    if (seconds < 90) {
        return t('error.retrySeconds', { count: seconds });
    }
    return t('error.retryMinutes', { count: Math.ceil(seconds / 60) });
}

function supportHint(supportEmail: unknown, t: Translate): string {
    return typeof supportEmail === 'string' && supportEmail.length > 0 ? t('error.support', { email: supportEmail }) : '';
}
