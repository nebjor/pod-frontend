import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../api/openapi';
import { OrderStatus } from '../order/order.models';
import { ADMIN_API_PREFIX } from './admin-auth.interceptor';
import { CalibrationQueueEntry, CalibrationReport, SliceCalibrationRow, SliceSource } from './calibration.models';

/** The owner's view of an order, as the backend publishes it. */
export type AdminOrder = components['schemas']['AdminOrderResponse'];
export type AdminOrderItem = components['schemas']['AdminOrderItemResponse'];

@Injectable({ providedIn: 'root' })
export class AdminApiService {
    private readonly http = inject(HttpClient);

    listOrders(status?: OrderStatus): Observable<AdminOrder[]> {
        const params: Record<string, string> = status ? { status } : {};
        return this.http.get<AdminOrder[]>(`${ADMIN_API_PREFIX}/orders`, { params });
    }

    getOrder(orderNumber: string): Observable<AdminOrder> {
        return this.http.get<AdminOrder>(`${ADMIN_API_PREFIX}/orders/${encodeURIComponent(orderNumber)}`);
    }

    setStatus(orderNumber: string, status: OrderStatus): Observable<AdminOrder> {
        return this.http.post<AdminOrder>(`${ADMIN_API_PREFIX}/orders/${encodeURIComponent(orderNumber)}/status`, { status });
    }

    /** The model of one order line (1-based position) as a blob; the caller turns it into a download. */
    downloadModel(orderNumber: string, position: number): Observable<Blob> {
        return this.http.get(`${ADMIN_API_PREFIX}/orders/${encodeURIComponent(orderNumber)}/items/${position}/model`, {
            responseType: 'blob'
        });
    }

    resetRateLimits(): Observable<{ reset: string }> {
        return this.http.post<{ reset: string }>(`${ADMIN_API_PREFIX}/rate-limits/reset`, null);
    }

    getCalibrationReport(): Observable<CalibrationReport> {
        return this.http.get<CalibrationReport>(`${ADMIN_API_PREFIX}/calibration/report`);
    }

    /** The latest stored slices, newest first; `source` narrows them to one origin. */
    getCalibrationRows(options: { limit?: number; source?: SliceSource } = {}): Observable<SliceCalibrationRow[]> {
        const params: Record<string, string> = { limit: String(options.limit ?? 200) };
        if (options.source) {
            params['source'] = options.source;
        }
        return this.http.get<SliceCalibrationRow[]>(`${ADMIN_API_PREFIX}/calibration/rows`, { params });
    }

    getCalibrationQueue(): Observable<CalibrationQueueEntry[]> {
        return this.http.get<CalibrationQueueEntry[]>(`${ADMIN_API_PREFIX}/calibration/queue`);
    }

    /** Puts one order line (1-based position) on the calibration queue; the backend answers 202. */
    enqueueCalibration(orderNumber: string, position: number): Observable<void> {
        return this.http.post<void>(
            `${ADMIN_API_PREFIX}/calibration/queue/order/${encodeURIComponent(orderNumber)}/${position}`,
            null
        );
    }

    /** Starts a manual calibration pass right away; 202. */
    runCalibrationNow(): Observable<void> {
        return this.http.post<void>(`${ADMIN_API_PREFIX}/calibration/run-now`, null);
    }

    /** All stored slice rows as CSV; the caller turns the blob into a download. */
    downloadCalibrationRows(): Observable<Blob> {
        return this.http.get(`${ADMIN_API_PREFIX}/calibration/rows.csv`, { responseType: 'blob' });
    }
}
