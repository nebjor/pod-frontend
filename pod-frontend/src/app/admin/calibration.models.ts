/*
 * ---------------------------------------------------------------------------------------------
 * HAND-WRITTEN TYPES for the admin calibration endpoints (/api/admin/calibration/*).
 *
 * The backend was built in parallel and its OpenAPI document does not describe these responses
 * yet. Once it does, replace this block with aliases on `components['schemas'][...]` from
 * `../api/openapi` and delete the interfaces below. Field names follow the agreed contract.
 * ---------------------------------------------------------------------------------------------
 */

/** Summary of measured values; every number is null while nothing has been measured. */
export interface CalibrationSummary {
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
}

/** A summary together with the sample size it was computed from. */
export interface CalibrationStat extends CalibrationSummary {
    n: number;
}

export const CALIBRATION_QUALITIES = ['coarse', 'medium', 'high', 'all'] as const;
export type CalibrationQuality = (typeof CALIBRATION_QUALITIES)[number];

/** Measured factor per filament (PETG, PCTG, ...) and quality bucket. */
export type CalibrationFactorStats = Record<string, Record<CalibrationQuality, CalibrationStat>>;

/** The factors the price estimate currently uses; they live in the backend's application.yml. */
export interface CalibrationConfigured {
    timeFactor: Record<string, number>;
    lengthFactor: Record<string, number>;
    plateOverheadSeconds: number;
}

/** How a plate of several copies compares with a single copy, keyed by copy count. */
export interface CalibrationQuantityStats {
    n: number;
    perCopyRatio: CalibrationSummary;
    plateOverheadSeconds: CalibrationSummary;
}

/** How far the arithmetic estimate for a copy count is off the sliced value, in percent. */
export interface CalibrationArithmeticError {
    n: number;
    meanAbsPercent: number | null;
    maxAbsPercent: number | null;
}

export interface CalibrationBoundingBox {
    widthMm: number;
    depthMm: number;
    heightMm: number;
}

/** One model the report lists as measured. */
export interface CalibrationModel {
    modelName: string;
    modelSha256: string;
    source: string;
    orderNumber: string | null;
    measuredAt: string;
    cells: number;
    triangleCount: number;
    bbox: CalibrationBoundingBox;
}

export interface CalibrationReport {
    /**
     * The contract names both the model count and the model list `models`, which one JSON
     * object cannot carry. The component accepts either reading: a number here with the list
     * under `calibratedModels`, or the list itself here.
     */
    models: number | CalibrationModel[];
    calibratedModels?: CalibrationModel[];
    /** Number of stored slice rows (model x filament x quality x quantity cells). */
    rows: number;
    /** How many of the rows each source contributed. */
    sources: Record<SliceSource, number>;
    configured: CalibrationConfigured;
    timeFactor: CalibrationFactorStats;
    lengthFactor: CalibrationFactorStats;
    quantity: Record<string, CalibrationQuantityStats>;
    arithmeticError: Record<string, CalibrationArithmeticError>;
}

/** Where a stored slice came from: a customer's quote, an order, or a manual run. */
export type SliceSource = 'quote' | 'order' | 'manual';

/** One stored slice, as GET /api/admin/calibration/rows lists them (newest first). */
export interface SliceCalibrationRow {
    id: number | string;
    measuredAt: string;
    source: SliceSource;
    modelName: string;
    modelSha256: string;
    modelSizeBytes: number;
    triangleCount: number;
    bbox: CalibrationBoundingBox;
    filament: string;
    quality: string;
    copies: number;
    plates: number;
    printSeconds: number;
    filamentLengthMm: number;
    filamentGrams: number;
    warningsCount: number;
    /** Null when the mesh check did not run. */
    manifold: boolean | null;
    /** Wall-clock time of the slicer run. */
    durationMs: number;
    slicerVersion: string;
    orderNumber: string | null;
}

/** One entry of the calibration work queue (last 50, newest first). */
export interface CalibrationQueueEntry {
    id: number | string;
    modelName: string;
    source: string;
    orderNumber: string | null;
    queuedAt: string;
    /** Null while the entry still waits for the next pass. */
    startedAt: string | null;
    /** Null while the entry runs or waits. */
    finishedAt: string | null;
    /** Set when the pass failed for this entry. */
    error: string | null;
}

/* ------------------------------ end of hand-written types ----------------------------------- */

export const SLICE_SOURCE_LABELS: Record<SliceSource, string> = {
    quote: 'Kundenanfrage',
    order: 'Bestellung',
    manual: 'manuell'
};

export type MeshState = 'ok' | 'open' | 'unchecked';

export const MESH_LABELS: Record<MeshState, string> = {
    ok: 'ok',
    open: 'nicht wasserdicht',
    unchecked: 'ungeprueft'
};

export function meshState(manifold: boolean | null): MeshState {
    if (manifold === null) {
        return 'unchecked';
    }
    return manifold ? 'ok' : 'open';
}

export function calibratedModelCount(report: CalibrationReport): number {
    return Array.isArray(report.models) ? report.models.length : report.models;
}

/** True once any factor or quantity cell was computed from at least one measurement. */
export function hasFactorStats(report: CalibrationReport): boolean {
    const factorCells = [report.timeFactor, report.lengthFactor].flatMap((stats) =>
        Object.values(stats ?? {}).flatMap((byQuality) => Object.values(byQuality))
    );
    const quantityCells = [...Object.values(report.quantity ?? {}), ...Object.values(report.arithmeticError ?? {})];
    return [...factorCells, ...quantityCells].some((cell) => cell.n > 0);
}

/** True when the measured median is more than `tolerance` (default 5 %) away from the configured value. */
export function deviates(median: number | null | undefined, configured: number | undefined, tolerance = 0.05): boolean {
    if (median == null || configured == null || configured === 0) {
        return false;
    }
    return Math.abs(median - configured) / configured > tolerance;
}
