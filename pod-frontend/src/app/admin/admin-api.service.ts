import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OrderStatus, OrderTotals } from '../order/order.models';
import { ADMIN_API_PREFIX } from './admin-auth.interceptor';

/** Mirrors the backend's AdminOrderResponse. */
export interface AdminOrder {
    orderNumber: string;
    status: OrderStatus;
    allowedTransitions: OrderStatus[];
    createdAt: string;
    quoteExpiresAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    deleteAfter: string | null;
    customerName: string;
    customerEmail: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    fileName: string;
    fileSizeBytes: number;
    filament: string;
    colorCode: string;
    colorLabel: string;
    quality: string;
    quantity: number;
    machineProfile: string;
    layerHeightMm: number;
    plateCount: number;
    totalPrintTimeSeconds: number;
    totalFilamentGrams: number;
    totals: OrderTotals;
    paymentProvider: string | null;
}

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
