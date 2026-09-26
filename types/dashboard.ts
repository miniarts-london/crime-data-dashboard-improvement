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

// A normalized crime row, tagged with the postcode whose search found it.
export interface CrimeRecord {
  id: string;
  postcode: string;
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
