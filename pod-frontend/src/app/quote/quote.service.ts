import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { QuoteOptions, QuoteRequestParams, QuoteResponse } from './quote.models';

/** Relative path; the dev server proxies `/api` to the Spring backend (see proxy.conf.js). */
export const QUOTE_API_URL = '/api/quotes';

@Injectable({ providedIn: 'root' })
export class QuoteService {
    private readonly http = inject(HttpClient);

    /** Uploads the model and lets the backend slice and price it. */
    requestQuote(file: File, params: QuoteRequestParams): Observable<QuoteResponse> {
        const body = new FormData();
        body.append('file', file, file.name);
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

/** Turns an HTTP failure into a message the upload page can show. */
export function describeQuoteError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        const problem = (error.error ?? null) as QuoteProblem | null;

        if (error.status === 0) {
            return 'Backend nicht erreichbar. Laeuft der Slicer-Service?';
        }
        if (error.status === 413) {
            return 'Die Datei ist zu gross fuer eine Online-Berechnung (max. 50 MB).';
        }
        if (error.status === 429) {
            return `Limit erreicht. Probier es ${formatRetry(problem?.retryAfterSeconds)} noch einmal.${supportHint(problem?.supportEmail)}`;
        }
        if (error.status === 503) {
            return `Der Slicer ist gerade ausgelastet. Probier es ${formatRetry(problem?.retryAfterSeconds)} noch einmal.`;
        }

        const detail = problem?.detail;
        if (typeof detail === 'string' && detail.length > 0) {
            return detail;
        }

        return `Angebot konnte nicht berechnet werden (HTTP ${error.status}).`;
    }

    return 'Angebot konnte nicht berechnet werden.';
}

function formatRetry(retryAfterSeconds: unknown): string {
    const seconds = typeof retryAfterSeconds === 'number' ? Math.ceil(retryAfterSeconds) : 0;
    if (seconds <= 0) {
        return 'spaeter';
    }
    if (seconds < 90) {
        return `in ${seconds} Sekunden`;
    }
    return `in ${Math.ceil(seconds / 60)} Minuten`;
}

function supportHint(supportEmail: unknown): string {
    return typeof supportEmail === 'string' && supportEmail.length > 0
        ? ` Falls es eilt, schreib an ${supportEmail}.`
        : '';
}
