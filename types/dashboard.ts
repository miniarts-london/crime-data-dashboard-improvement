import type { z } from 'zod';
import type {
  GeocodeResultSchema,
  RawCrimeLocationSchema,
  RawCrimeOutcomeSchema,
  RawCrimeSchema,
} from '@/lib/schemas';

export interface InitialParams {
  postcodes: string[];
  from: string;
  to: string;
}

// Shapes of external data, inferred from the runtime schemas in lib/schemas.ts.
// RawCrime is the shape returned by https://data.police.uk/api/crimes-street/all-crime
export type RawCrimeLocation = z.infer<typeof RawCrimeLocationSchema>;
export type RawCrimeOutcome = z.infer<typeof RawCrimeOutcomeSchema>;
export type RawCrime = z.infer<typeof RawCrimeSchema>;
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

// A normalized crime row. `id` is the police API's own crime id, so the same
// crime found by two nearby postcodes (their 1-mile search radii overlap) is
// one row, tagged with every searched postcode it is near.
export interface CrimeRecord {
  id: string;
  postcodes: string[];
  hasLocation: boolean;
  lat: number | null;
  lng: number | null;
  category: string;
  bucket: string;
  street: string;
  month: string;
  outcome: string;
}

export interface SearchPoint {
  postcode: string;
  lat: number;
  lng: number;
}

export interface QuickFilters {
  postcode: string | null;
  category: string | null;
  outcome: string | null;
}
