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

/** One model that went through the nightly calibration pass. */
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
    /** Number of measurement rows (model x filament x quality x quantity cells). */
    rows: number;
    configured: CalibrationConfigured;
    timeFactor: CalibrationFactorStats;
    lengthFactor: CalibrationFactorStats;
    quantity: Record<string, CalibrationQuantityStats>;
    arithmeticError: Record<string, CalibrationArithmeticError>;
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

export type CalibrationQueueStatus = 'queued' | 'running' | 'done' | 'failed';

export const QUEUE_STATUS_LABELS: Record<CalibrationQueueStatus, string> = {
    queued: 'wartend',
    running: 'laeuft',
    done: 'fertig',
    failed: 'Fehler'
};

export function queueStatus(entry: CalibrationQueueEntry): CalibrationQueueStatus {
    if (entry.error) {
        return 'failed';
    }
    if (entry.finishedAt) {
        return 'done';
    }
    return entry.startedAt ? 'running' : 'queued';
}

export function calibratedModels(report: CalibrationReport): CalibrationModel[] {
    return Array.isArray(report.models) ? report.models : (report.calibratedModels ?? []);
}

export function calibratedModelCount(report: CalibrationReport): number {
    return Array.isArray(report.models) ? report.models.length : report.models;
}

/** True when the measured median is more than `tolerance` (default 5 %) away from the configured value. */
export function deviates(median: number | null | undefined, configured: number | undefined, tolerance = 0.05): boolean {
    if (median == null || configured == null || configured === 0) {
        return false;
    }
    return Math.abs(median - configured) / configured > tolerance;
}
