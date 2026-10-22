import { TranslationKey } from '../i18n/de';
import { Translate, translateDe } from '../i18n/i18n.service';
import { OrderStatus } from './order.models';

/** The way an order normally goes, in the order the status page draws the steps. */
export const ORDER_STATUS_STEPS: readonly OrderStatus[] = ['NEW', 'PAID', 'IN_REVIEW', 'APPROVED', 'PRINTING', 'SHIPPED'];

/** Translation key of each status label. */
export const ORDER_STATUS_KEYS: Record<OrderStatus, TranslationKey> = {
    NEW: 'orderStatus.NEW',
    PAID: 'orderStatus.PAID',
    IN_REVIEW: 'orderStatus.IN_REVIEW',
    APPROVED: 'orderStatus.APPROVED',
    PRINTING: 'orderStatus.PRINTING',
    SHIPPED: 'orderStatus.SHIPPED',
    CANCELLED: 'orderStatus.CANCELLED'
};

/** The status in words; `t` picks the language, German without it. An unknown status is shown as is. */
export function orderStatusLabel(status: OrderStatus, t: Translate = translateDe): string {
    const key = ORDER_STATUS_KEYS[status];
    return key ? t(key) : status;
}
