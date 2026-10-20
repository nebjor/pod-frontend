import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../api/openapi';
import { OrderStatus } from '../order/order.models';
import { ADMIN_API_PREFIX } from './admin-auth.interceptor';

/** The owner's view of an order, as the backend publishes it. */
export type AdminOrder = components['schemas']['AdminOrderResponse'];

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

    /** The uploaded model as a blob; the caller turns it into a download. */
    downloadModel(orderNumber: string): Observable<Blob> {
        return this.http.get(`${ADMIN_API_PREFIX}/orders/${encodeURIComponent(orderNumber)}/model`, {
            responseType: 'blob'
        });
    }

    resetRateLimits(): Observable<{ reset: string }> {
        return this.http.post<{ reset: string }>(`${ADMIN_API_PREFIX}/rate-limits/reset`, null);
    }
}
