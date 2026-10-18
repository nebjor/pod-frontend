/** Mirrors the JSON contract of the cad-slicer-engine quote API (`/api/quotes`). */

export type FilamentCode = 'PLA' | 'PETG';
export type QualityCode = 'coarse' | 'medium' | 'high';

export interface QuoteRequestParams {
    filament: FilamentCode;
    quality: QualityCode;
    quantity: number;
}

export interface BoundingBoxMm {
    widthMm: number;
    depthMm: number;
    heightMm: number;
}

export interface QuoteResponse {
    fileName: string;
    filament: string;
    quality: string;
    quantity: number;
    machineProfile: string;
    layerHeightMm: number;
    /** Plates the whole batch occupies. */
    plateCount: number;
    /** Effective print time per unit (batch total divided by quantity). */
    printTimeSeconds: number;
    /** Print time for the whole batch, all plates. */
    totalPrintTimeSeconds: number;
    filamentLengthMm: number;
    /** Material per unit. */
    filamentGrams: number;
    /** Material for the whole batch. */
    totalFilamentGrams: number;
    boundingBoxMm: BoundingBoxMm;
    triangleCount: number;
    machineCostChf: number;
    materialCostChf: number;
    setupFeeChf: number;
    unitPriceChf: number;
    totalPriceChf: number;
    currency: string;
    leadTimeDays: number;
}

export interface FilamentOption {
    code: string;
    label: string;
    profileName: string;
}

export interface QualityOption {
    code: string;
    label: string;
    layerHeightMm: number;
    baseLeadTimeDays: number;
}

export interface QuoteOptions {
    filaments: FilamentOption[];
    qualities: QualityOption[];
    maxQuantity: number;
}
