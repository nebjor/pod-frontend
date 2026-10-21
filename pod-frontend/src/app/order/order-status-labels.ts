import { OrderStatus } from './order.models';

/** The way an order normally goes, in the order the status page draws the steps. */
export const ORDER_STATUS_STEPS: readonly OrderStatus[] = ['NEW', 'PAID', 'IN_REVIEW', 'APPROVED', 'PRINTING', 'SHIPPED'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    NEW: 'Neu',
    PAID: 'Bezahlt',
    IN_REVIEW: 'In Pruefung',
    APPROVED: 'Freigegeben',
    PRINTING: 'Im Druck',
    SHIPPED: 'Versendet',
    CANCELLED: 'Storniert'
};

export function orderStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
}
