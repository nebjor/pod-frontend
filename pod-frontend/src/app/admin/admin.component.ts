import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrderStatus } from '../order/order.models';
import { describeQuoteError } from '../quote/quote.service';
import { formatPrintDuration } from '../quote/print-duration';
import { AdminApiService, AdminOrder, AdminOrderItem } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import {
    CALIBRATION_QUALITIES,
    CalibrationFactorStats,
    CalibrationModel,
    CalibrationQuality,
    CalibrationQueueEntry,
    CalibrationQueueStatus,
    CalibrationReport,
    QUEUE_STATUS_LABELS,
    calibratedModelCount,
    calibratedModels,
    deviates,
    queueStatus
} from './calibration.models';

/** Owner-facing labels for each state and for the button that moves an order into it. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
    NEW: 'Neu, unbezahlt',
    PAID: 'Bezahlt',
    IN_REVIEW: 'In Pruefung',
    APPROVED: 'Freigegeben',
    PRINTING: 'Im Druck',
    SHIPPED: 'Versendet',
    CANCELLED: 'Storniert'
};

export const TRANSITION_LABELS: Record<OrderStatus, string> = {
    NEW: 'Zurueck auf neu',
    PAID: 'Als bezahlt markieren',
    IN_REVIEW: 'Pruefung starten',
    APPROVED: 'Freigeben',
    PRINTING: 'Druck starten',
    SHIPPED: 'Als versendet markieren',
    CANCELLED: 'Stornieren'
};

type ListState = 'checking' | 'login' | 'loading' | 'ready' | 'error';
type AdminTab = 'orders' | 'calibration';
type CalibrationState = 'idle' | 'loading' | 'ready' | 'error';

/** How long the backend gets to pick up a "run now" before the queue is read again. */
export const RUN_NOW_REFRESH_MS = 2000;
/** The plate overhead the quantity table compares against when the report carries none. */
const DEFAULT_PLATE_OVERHEAD_SECONDS = 300;

@Component({
    selector: 'app-admin',
    imports: [ReactiveFormsModule, DecimalPipe, DatePipe],
    templateUrl: './admin.component.html',
    styleUrl: './admin.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent {
    private readonly api = inject(AdminApiService);
    private readonly auth = inject(AdminAuthService);
    private readonly destroyRef = inject(DestroyRef);

    readonly statusLabels = STATUS_LABELS;
    readonly transitionLabels = TRANSITION_LABELS;
    readonly statusOptions: OrderStatus[] = ['NEW', 'PAID', 'IN_REVIEW', 'APPROVED', 'PRINTING', 'SHIPPED', 'CANCELLED'];

    readonly state = signal<ListState>('checking');
    readonly tab = signal<AdminTab>('orders');
    readonly orders = signal<AdminOrder[]>([]);
    readonly filter = signal<OrderStatus | ''>('');
    readonly selectedNumber = signal<string | null>(null);
    readonly errorMessage = signal('');
    readonly notice = signal('');
    readonly busy = signal(false);

    readonly calibrationState = signal<CalibrationState>('idle');
    readonly report = signal<CalibrationReport | null>(null);
    readonly queue = signal<CalibrationQueueEntry[]>([]);
    readonly calibrationError = signal('');
    /** Order lines put on the calibration queue from this page, as "orderNumber/position". */
    readonly enqueued = signal<ReadonlySet<string>>(new Set());

    readonly qualities = CALIBRATION_QUALITIES;
    readonly queueStatusLabels = QUEUE_STATUS_LABELS;
    readonly modelCount = computed(() => (this.report() ? calibratedModelCount(this.report()!) : 0));
    readonly calibratedModels = computed<CalibrationModel[]>(() => (this.report() ? calibratedModels(this.report()!) : []));
    /** Filaments in the order the report lists them; the configured map adds any without measurements. */
    readonly filaments = computed(() => {
        const report = this.report();
        if (!report) {
            return [];
        }
        return [...new Set([...Object.keys(report.timeFactor ?? {}), ...Object.keys(report.configured?.timeFactor ?? {})])];
    });
    readonly quantities = computed(() => {
        const report = this.report();
        const keys = report ? [...new Set([...Object.keys(report.quantity ?? {}), ...Object.keys(report.arithmeticError ?? {})])] : [];
        return keys.sort((a, b) => Number(a) - Number(b));
    });
    readonly configuredPlateOverhead = computed(
        () => this.report()?.configured?.plateOverheadSeconds ?? DEFAULT_PLATE_OVERHEAD_SECONDS
    );

    readonly selected = computed(() => this.orders().find((order) => order.orderNumber === this.selectedNumber()) ?? null);
    /** Print time and material of the whole order; each line already covers all its copies. */
    readonly selectedPrintTime = computed(() =>
        formatPrintDuration((this.selected()?.items ?? []).reduce((sum, item) => sum + item.printTimeSeconds, 0))
    );
    readonly selectedFilamentGrams = computed(() =>
        (this.selected()?.items ?? []).reduce((sum, item) => sum + item.filamentGrams, 0)
    );

    readonly loginForm = new FormGroup({
        username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });

    constructor() {
        afterNextRender(() => {
            this.auth.restore();
            if (this.auth.loggedIn()) {
                this.load();
            } else {
                this.state.set('login');
            }
        });
    }

    login() {
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }
        const { username, password } = this.loginForm.getRawValue();
        this.auth.login(username, password);
        this.load();
    }

    logout() {
        this.auth.logout();
        this.orders.set([]);
        this.selectedNumber.set(null);
        this.report.set(null);
        this.queue.set([]);
        this.calibrationState.set('idle');
        this.tab.set('orders');
        this.state.set('login');
    }

    showTab(tab: AdminTab) {
        this.tab.set(tab);
        if (tab === 'calibration' && this.calibrationState() === 'idle') {
            this.loadCalibration();
        }
    }

    setFilter(value: string) {
        this.filter.set(value as OrderStatus | '');
        this.load();
    }

    select(orderNumber: string) {
        this.selectedNumber.set(this.selectedNumber() === orderNumber ? null : orderNumber);
    }

    /** One line for the list: the file name alone, or the count and the names of all lines. */
    itemSummary(order: AdminOrder): string {
        const names = order.items.map((item) => item.fileName);
        return names.length === 1 ? names[0] : `${names.length} Positionen: ${names.join(', ')}`;
    }

    printTime(item: AdminOrderItem): string {
        return formatPrintDuration(item.printTimeSeconds);
    }

    load() {
        this.state.set('loading');
        this.errorMessage.set('');
        this.api
            .listOrders(this.filter() || undefined)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (orders) => {
                    this.orders.set(orders);
                    this.state.set('ready');
                },
                error: (error: unknown) => this.fail(error)
            });
    }

    transition(order: AdminOrder, status: OrderStatus) {
        if (this.busy()) {
            return;
        }
        this.busy.set(true);
        this.notice.set('');
        this.api
            .setStatus(order.orderNumber, status)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.orders.update((list) => list.map((item) => (item.orderNumber === updated.orderNumber ? updated : item)));
                    this.notice.set(`${updated.orderNumber}: ${STATUS_LABELS[updated.status]}`);
                    this.busy.set(false);
                },
                error: (error: unknown) => {
                    this.busy.set(false);
                    this.errorMessage.set(describeQuoteError(error));
                }
            });
    }

    download(order: AdminOrder, item: AdminOrderItem) {
        this.api
            .downloadModel(order.orderNumber, item.position)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => saveBlob(blob, `${order.orderNumber}_${item.position}_${item.fileName}`),
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    resetRateLimits() {
        this.api
            .resetRateLimits()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.notice.set('Rate-Limits zurueckgesetzt.'),
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    loadCalibration() {
        this.calibrationState.set('loading');
        this.calibrationError.set('');
        forkJoin({ report: this.api.getCalibrationReport(), queue: this.api.getCalibrationQueue() })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ report, queue }) => {
                    this.report.set(report);
                    this.queue.set(queue);
                    this.calibrationState.set('ready');
                },
                error: (error: unknown) => this.failCalibration(error)
            });
    }

    loadQueue() {
        this.api
            .getCalibrationQueue()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (queue) => this.queue.set(queue),
                error: (error: unknown) => this.failCalibration(error)
            });
    }

    runCalibrationNow() {
        if (this.busy()) {
            return;
        }
        this.busy.set(true);
        this.calibrationError.set('');
        this.api
            .runCalibrationNow()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busy.set(false);
                    this.notice.set('Kalibrierung gestartet.');
                    setTimeout(() => this.loadQueue(), RUN_NOW_REFRESH_MS);
                },
                error: (error: unknown) => {
                    this.busy.set(false);
                    this.calibrationError.set(describeQuoteError(error));
                }
            });
    }

    exportCalibrationCsv() {
        this.api
            .downloadCalibrationRows()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => saveBlob(blob, 'kalibrierung.csv'),
                error: (error: unknown) => this.calibrationError.set(describeQuoteError(error))
            });
    }

    isEnqueued(order: AdminOrder, item: AdminOrderItem): boolean {
        return this.enqueued().has(enqueueKey(order, item));
    }

    /** Puts one order line on the calibration queue; the line then reads "In Warteschlange". */
    enqueue(order: AdminOrder, item: AdminOrderItem) {
        if (this.isEnqueued(order, item)) {
            return;
        }
        this.api
            .enqueueCalibration(order.orderNumber, item.position)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.enqueued.update((set) => new Set(set).add(enqueueKey(order, item)));
                    this.notice.set(`${item.fileName}: in der Kalibrierungs-Warteschlange.`);
                    // The queue list is stale now; refresh it when it has been loaded already.
                    if (this.calibrationState() === 'ready') {
                        this.loadQueue();
                    }
                },
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    /** Jumps from a calibrated model to its order; loads the unfiltered list when the order is not in it. */
    openOrder(orderNumber: string) {
        this.tab.set('orders');
        this.selectedNumber.set(orderNumber);
        if (!this.orders().some((order) => order.orderNumber === orderNumber)) {
            this.filter.set('');
            this.load();
        }
    }

    /** The measured median of one factor cell, or null when nothing was measured. */
    median(stats: CalibrationFactorStats | undefined, filament: string, quality: CalibrationQuality): number | null {
        return stats?.[filament]?.[quality]?.median ?? null;
    }

    sampleSize(stats: CalibrationFactorStats | undefined, filament: string, quality: CalibrationQuality): number {
        return stats?.[filament]?.[quality]?.n ?? 0;
    }

    /** Amber highlight when the measured median is more than 5 % away from the configured factor. */
    factorDeviates(
        stats: CalibrationFactorStats | undefined,
        configured: Record<string, number> | undefined,
        filament: string,
        quality: CalibrationQuality
    ): boolean {
        return deviates(this.median(stats, filament, quality), configured?.[filament]);
    }

    arithmeticDeviates(copies: string): boolean {
        const mean = this.report()?.arithmeticError?.[copies]?.meanAbsPercent;
        return mean != null && mean > 5;
    }

    queueStatus(entry: CalibrationQueueEntry): CalibrationQueueStatus {
        return queueStatus(entry);
    }

    private failCalibration(error: unknown) {
        if (!this.auth.loggedIn()) {
            this.fail(error);
            return;
        }
        this.calibrationState.set('error');
        this.calibrationError.set(describeQuoteError(error));
    }

    private fail(error: unknown) {
        if (!this.auth.loggedIn()) {
            // The interceptor dropped rejected credentials.
            this.state.set('login');
            this.errorMessage.set('Anmeldung fehlgeschlagen. Bitte Zugangsdaten pruefen.');
            return;
        }
        this.state.set('error');
        this.errorMessage.set(describeQuoteError(error));
    }
}

function enqueueKey(order: AdminOrder, item: AdminOrderItem): string {
    return `${order.orderNumber}/${item.position}`;
}

/** Triggers a browser download for a blob; no-op outside the browser. */
export function saveBlob(blob: Blob, fileName: string) {
    if (typeof document === 'undefined') {
        return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
