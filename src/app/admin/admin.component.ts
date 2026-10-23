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
    CalibrationQuality,
    CalibrationReport,
    MESH_LABELS,
    MeshState,
    SLICE_SOURCE_LABELS,
    SliceCalibrationRow,
    SliceSource,
    calibratedModelCount,
    deviates,
    hasFactorStats,
    meshState
} from './calibration.models';

/** Owner-facing labels for each state and for the button that moves an order into it. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
    NEW: 'Neu, unbezahlt',
    PAID: 'Bezahlt',
    IN_REVIEW: 'In Prüfung',
    APPROVED: 'Freigegeben',
    PRINTING: 'Im Druck',
    SHIPPED: 'Versendet',
    CANCELLED: 'Storniert'
};

export const TRANSITION_LABELS: Record<OrderStatus, string> = {
    NEW: 'Zurück auf neu',
    PAID: 'Als bezahlt markieren',
    IN_REVIEW: 'Prüfung starten',
    APPROVED: 'Freigeben',
    PRINTING: 'Druck starten',
    SHIPPED: 'Als versendet markieren',
    CANCELLED: 'Stornieren'
};

type ListState = 'checking' | 'login' | 'loading' | 'ready' | 'error';
type AdminTab = 'orders' | 'slices';
type SliceState = 'idle' | 'loading' | 'ready' | 'error';
/** The source filter of the slice table; the empty string lists every source. */
export type SliceSourceFilter = SliceSource | '';

/** How many of the newest slice rows the tab shows. */
export const SLICE_ROW_LIMIT = 200;
/** The filter buttons above the slice table, in display order. */
export const SLICE_SOURCE_FILTERS: { value: SliceSourceFilter; label: string }[] = [
    { value: '', label: 'alle' },
    { value: 'quote', label: 'Kundenanfragen' },
    { value: 'manual', label: 'manuell' }
];
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

    readonly sliceState = signal<SliceState>('idle');
    readonly report = signal<CalibrationReport | null>(null);
    readonly rows = signal<SliceCalibrationRow[]>([]);
    readonly sourceFilter = signal<SliceSourceFilter>('');
    readonly sliceError = signal('');

    readonly qualities = CALIBRATION_QUALITIES;
    readonly sourceFilters = SLICE_SOURCE_FILTERS;
    readonly sourceLabels = SLICE_SOURCE_LABELS;
    readonly meshLabels = MESH_LABELS;
    readonly modelCount = computed(() => (this.report() ? calibratedModelCount(this.report()!) : 0));
    /** The factor tables only mean something once a manual series produced at least one stat. */
    readonly showFactors = computed(() => (this.report() ? hasFactorStats(this.report()!) : false));
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
        this.rows.set([]);
        this.sourceFilter.set('');
        this.sliceState.set('idle');
        this.tab.set('orders');
        this.state.set('login');
    }

    showTab(tab: AdminTab) {
        this.tab.set(tab);
        if (tab === 'slices' && this.sliceState() === 'idle') {
            this.loadSlices();
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
                next: () => this.notice.set('Rate-Limits zurückgesetzt.'),
                error: (error: unknown) => this.errorMessage.set(describeQuoteError(error))
            });
    }

    loadSlices() {
        this.sliceState.set('loading');
        this.sliceError.set('');
        forkJoin({ report: this.api.getCalibrationReport(), rows: this.api.getCalibrationRows(this.rowsQuery()) })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ report, rows }) => {
                    this.report.set(report);
                    this.rows.set(rows);
                    this.sliceState.set('ready');
                },
                error: (error: unknown) => this.failSlices(error)
            });
    }

    /** Narrows the table to one source; the summary above it keeps counting every source. */
    setSourceFilter(source: SliceSourceFilter) {
        if (this.sourceFilter() === source) {
            return;
        }
        this.sourceFilter.set(source);
        this.sliceError.set('');
        this.api
            .getCalibrationRows(this.rowsQuery())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (rows) => this.rows.set(rows),
                error: (error: unknown) => this.failSlices(error)
            });
    }

    exportSlicesCsv() {
        this.api
            .downloadCalibrationRows()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => saveBlob(blob, 'slices.csv'),
                error: (error: unknown) => this.sliceError.set(describeQuoteError(error))
            });
    }

    /** Print time of one row the way the order pages show it ("1 h 04 min"). */
    rowPrintTime(row: SliceCalibrationRow): string {
        return formatPrintDuration(row.printSeconds);
    }

    /** The first characters of the model hash, enough to tell two uploads of the same name apart. */
    shortSha(row: SliceCalibrationRow): string {
        return row.modelSha256.slice(0, 8);
    }

    mesh(row: SliceCalibrationRow): MeshState {
        return meshState(row.manifold);
    }

    /** Jumps from a slice row to its order; loads the unfiltered list when the order is not in it. */
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

    private rowsQuery(): { limit: number; source?: SliceSource } {
        const source = this.sourceFilter();
        return source ? { limit: SLICE_ROW_LIMIT, source } : { limit: SLICE_ROW_LIMIT };
    }

    private failSlices(error: unknown) {
        if (!this.auth.loggedIn()) {
            this.fail(error);
            return;
        }
        this.sliceState.set('error');
        this.sliceError.set(describeQuoteError(error));
    }

    private fail(error: unknown) {
        if (!this.auth.loggedIn()) {
            // The interceptor dropped rejected credentials.
            this.state.set('login');
            this.errorMessage.set('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
            return;
        }
        this.state.set('error');
        this.errorMessage.set(describeQuoteError(error));
    }
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
