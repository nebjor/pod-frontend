import { QUALITY_LABEL_FALLBACK, formatQualityOption, qualityLabel } from './quality-labels';
import { QualityOption } from './quote.models';

const catalogue: QualityOption[] = [
    { code: 'coarse', label: 'Grob', layerHeightMm: 0.24, baseLeadTimeDays: 2, profileName: '0.24mm Draft @BBL A1' },
    { code: 'medium', label: 'Standard', layerHeightMm: 0.2, baseLeadTimeDays: 3, profileName: '0.20mm Standard @BBL A1' },
    { code: 'high', label: 'Fein', layerHeightMm: 0.12, baseLeadTimeDays: 4, profileName: '0.12mm Fine @BBL A1' }
];

describe('qualityLabel', () => {
    it('prefers the catalogue label and adds the layer height with two decimals', () => {
        expect(qualityLabel('medium', catalogue)).toBe('Standard 0.20 mm');
        expect(qualityLabel('coarse', catalogue)).toBe('Grob 0.24 mm');
        expect(qualityLabel('high', catalogue)).toBe('Fein 0.12 mm');
    });

    it('falls back to the built-in list without a catalogue', () => {
        expect(qualityLabel('medium')).toBe('Standard 0.20 mm');
        expect(qualityLabel('coarse', [])).toBe('Grob 0.24 mm');
        expect(qualityLabel('high')).toBe('Fein 0.12 mm');
    });

    it('uses the catalogue over the fallback when the shop renames a tier', () => {
        const renamed = [{ ...catalogue[1], label: 'Normal' }];
        expect(qualityLabel('medium', renamed)).toBe('Normal 0.20 mm');
        // Codes the partial catalogue does not carry still come from the fallback.
        expect(qualityLabel('high', renamed)).toBe('Fein 0.12 mm');
    });

    it('shows an unknown code as it is rather than nothing', () => {
        expect(qualityLabel('ultra')).toBe('ultra');
        expect(qualityLabel('ultra', catalogue)).toBe('ultra');
    });

    it('formats a catalogue option the same way everywhere', () => {
        expect(formatQualityOption(catalogue[0])).toBe('Grob 0.24 mm');
        expect(Object.keys(QUALITY_LABEL_FALLBACK)).toEqual(['coarse', 'medium', 'high']);
    });
});
