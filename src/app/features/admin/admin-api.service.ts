import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '@core/api/openapi';
import { OrderStatus } from '@core/order/order.models';
import { ADMIN_API_PREFIX } from './admin-auth.interceptor';
import { CalibrationReport, SliceCalibrationRow, SliceSource } from './calibration.models';

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

    /** All stored slice rows as CSV; the caller turns the blob into a download. */
    downloadCalibrationRows(): Observable<Blob> {
        return this.http.get(`${ADMIN_API_PREFIX}/calibration/rows.csv`, { responseType: 'blob' });
    }
}
