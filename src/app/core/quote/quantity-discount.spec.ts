import { describe, expect, it } from 'vitest';
import { quantityDiscountPercent } from './quality-labels';

describe('quantityDiscountPercent', () => {
    it('is the saving per piece against the single-piece price, rounded to whole percent', () => {
        expect(quantityDiscountPercent({ quantity: 4, unitPriceChf: 3.25, unitPriceSingleChf: 3.6 })).toBe(10);
        expect(quantityDiscountPercent({ quantity: 10, unitPriceChf: 3, unitPriceSingleChf: 4 })).toBe(25);
    });

    it('is zero for one piece or when the batch is not cheaper', () => {
        expect(quantityDiscountPercent({ quantity: 1, unitPriceChf: 3.6, unitPriceSingleChf: 3.6 })).toBe(0);
        expect(quantityDiscountPercent({ quantity: 3, unitPriceChf: 3, unitPriceSingleChf: 3 })).toBe(0);
        expect(quantityDiscountPercent({ quantity: 3, unitPriceChf: 3, unitPriceSingleChf: 0 })).toBe(0);
    });
});
