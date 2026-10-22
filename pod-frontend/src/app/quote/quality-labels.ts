import { TranslationKey } from '../i18n/de';
import { Translate, translateDe } from '../i18n/i18n.service';
import { QualityOption } from './quote.models';

/**
 * Layer height in mm of the tiers the shop sells. The order responses carry the quality code
 * only, and the codes are an enum in the backend, so this list matches the catalogue
 * `GET /api/quotes/options` publishes; an unknown code is shown as is.
 */
export const QUALITY_LAYER_HEIGHT_FALLBACK: Readonly<Record<string, number>> = {
    coarse: 0.24,
    medium: 0.2,
    high: 0.12
};

/** Translation key of the name of each known tier. */
const QUALITY_NAME_KEYS: Readonly<Record<string, TranslationKey>> = {
    coarse: 'quality.coarse',
    medium: 'quality.medium',
    high: 'quality.high'
};

/**
 * The name of a tier. The catalogue's own label is German; when it is the one this app knows
 * for the code it is translated, and a label the backend has changed since is shown as it is.
 */
function qualityName(code: string, catalogueLabel: string | undefined, t: Translate): string {
    const key = QUALITY_NAME_KEYS[code];
    if (!key) {
        return catalogueLabel ?? code;
    }
    if (catalogueLabel !== undefined && catalogueLabel !== translateDe(key)) {
        return catalogueLabel;
    }
    return t(key);
}

/** "Standard 0.20 mm": the tier's name with the layer height, the way every page shows it. */
export function formatQualityOption(option: QualityOption, t: Translate = translateDe): string {
    return `${qualityName(option.code, option.label, t)} ${option.layerHeightMm.toFixed(2)} mm`;
}

/**
 * Label for a quality code: from the catalogue when it is available, from the fallback list
 * otherwise, and the bare code when neither knows it. Every page that shows a quality uses
 * this, so a code like "medium" never reaches the customer. `t` words the tier's name in the
 * active language; without it the label is German.
 */
export function qualityLabel(code: string, qualities: ReadonlyArray<QualityOption> = [], t: Translate = translateDe): string {
    const option = qualities.find((candidate) => candidate.code === code);
    if (option) {
        return formatQualityOption(option, t);
    }
    const layerHeight = QUALITY_LAYER_HEIGHT_FALLBACK[code];
    return layerHeight === undefined ? code : `${qualityName(code, undefined, t)} ${layerHeight.toFixed(2)} mm`;
}

/**
 * Percent a piece is cheaper in this batch than printed alone, from the single-piece price the
 * backend sends next to the batch unit price; 0 when there is no saving worth showing.
 */
export function quantityDiscountPercent(quote: { quantity: number; unitPriceChf: number; unitPriceSingleChf: number }): number {
    if (quote.quantity <= 1 || !(quote.unitPriceSingleChf > quote.unitPriceChf)) {
        return 0;
    }
    return Math.round((1 - quote.unitPriceChf / quote.unitPriceSingleChf) * 100);
}
