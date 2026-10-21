import { QualityOption } from './quote.models';

/**
 * What the customer reads for a quality code when the catalogue is not at hand. The order
 * responses carry the code only, and the codes are an enum in the backend, so this list
 * matches the catalogue `GET /api/quotes/options` publishes; an unknown code is shown as is.
 */
export const QUALITY_LABEL_FALLBACK: Readonly<Record<string, string>> = {
    coarse: 'Grob 0.24 mm',
    medium: 'Standard 0.20 mm',
    high: 'Fein 0.12 mm'
};

/** "Standard 0.20 mm": the catalogue label with the layer height, the way every page shows it. */
export function formatQualityOption(option: QualityOption): string {
    return `${option.label} ${option.layerHeightMm.toFixed(2)} mm`;
}

/**
 * Label for a quality code: from the catalogue when it is available, from the fallback list
 * otherwise, and the bare code when neither knows it. Every page that shows a quality uses
 * this, so a code like "medium" never reaches the customer.
 */
export function qualityLabel(code: string, qualities: ReadonlyArray<QualityOption> = []): string {
    const option = qualities.find((candidate) => candidate.code === code);
    if (option) {
        return formatQualityOption(option);
    }
    return QUALITY_LABEL_FALLBACK[code] ?? code;
}
