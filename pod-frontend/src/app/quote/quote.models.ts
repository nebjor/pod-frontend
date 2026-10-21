/**
 * Quote API models (`/api/quotes`). Response shapes are aliases of the generated contract in
 * `src/app/api/openapi.d.ts`, so a backend change that alters them fails this build instead
 * of surprising a customer. Request parameters are hand-written: they are what we send.
 *
 * Filament and quality codes are plain strings on purpose: the backend owns the catalogue
 * and publishes it through `/api/quotes/options`, so adding a material there must never
 * require a frontend change.
 */
import type { components } from '../api/openapi';

type Schemas = components['schemas'];

export type ColorOption = Schemas['ColorOption'];
export type QuoteResponse = Schemas['QuoteResponse'];
export type FilamentOption = Schemas['FilamentOption'];
export type QualityOption = Schemas['QualityOption'];
export type QuoteOptions = Schemas['QuoteOptions'];
export type UploadedModel = Schemas['UploadedModel'];

export interface QuoteRequestParams {
    /** Filament code from `QuoteOptions.filaments`. */
    filament: string;
    /** Colour code from the filament's `colors` list; it does not affect time or price. */
    color: string;
    /** Quality code from `QuoteOptions.qualities`. */
    quality: string;
    quantity: number;
}
