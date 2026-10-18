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
        body.append('quality', params.quality);
        body.append('quantity', String(params.quantity));

        return this.http.post<QuoteResponse>(QUOTE_API_URL, body);
    }

    /** Filaments, qualities and limits the backend currently accepts. */
    loadOptions(): Observable<QuoteOptions> {
        return this.http.get<QuoteOptions>(`${QUOTE_API_URL}/options`);
    }
}

/** Turns an HTTP failure into a message the upload page can show. */
export function describeQuoteError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
            return 'Backend nicht erreichbar. Laeuft der Slicer-Service?';
        }
        if (error.status === 413) {
            return 'Die Datei ist zu gross fuer eine Online-Berechnung (max. 50 MB).';
        }

        const detail = (error.error as { detail?: unknown } | null)?.detail;
        if (typeof detail === 'string' && detail.length > 0) {
            return detail;
        }

        return `Angebot konnte nicht berechnet werden (HTTP ${error.status}).`;
    }

    return 'Angebot konnte nicht berechnet werden.';
}
