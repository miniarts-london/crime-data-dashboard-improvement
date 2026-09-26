import { z } from 'zod';
import { normalizePostcode, POSTCODE_REGEX } from '@/lib/postcodes';

// Runtime schemas for every piece of data that enters the app from outside -
// upstream API responses and our own routes' request params. The matching
// TypeScript types in types/dashboard.ts are inferred from these, so the
// check and the type can't drift apart.

// ---- police.uk: /crimes-street/all-crime -------------------------------

export const RawCrimeLocationSchema = z.object({
  latitude: z.string(),
  longitude: z.string(),
  street: z.object({ id: z.number(), name: z.string() }).optional(),
});

export const RawCrimeOutcomeSchema = z.object({
  category: z.string(),
  date: z.string(),
});

// Unknown keys (context, location_type, ...) are stripped, which also keeps
// our route's response down to the fields the dashboard actually uses.
export const RawCrimeSchema = z.object({
  category: z.string(),
  id: z.number().optional(),
  persistent_id: z.string().optional(),
  month: z.string(),
  location: RawCrimeLocationSchema.nullish(),
  outcome_status: RawCrimeOutcomeSchema.nullish(),
});

// ---- getthedata.com: /postcode/{postcode} ------------------------------

// Coordinates arrive as strings; an empty or non-numeric one fails here
// instead of turning into NaN (or 0) further down.
const coordinateString = z.string().trim().min(1).pipe(z.coerce.number());

export const GetTheDataPostcodeResponseSchema = z.object({
  status: z.string(),
  notice: z.string().optional(),
  data: z
    .object({
      postcode: z.string(),
      latitude: coordinateString,
      longitude: coordinateString,
    })
    .optional(),
});

export const GeocodeResultSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});

// ---- postcodes.io: /postcodes/{query}/autocomplete ---------------------

export const AutocompleteResponseSchema = z.object({
  result: z.array(z.string()).nullable(),
});

// ---- Our route handlers' inputs ----------------------------------------

export const CrimesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const PostcodeParamSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return normalizePostcode(decodeURIComponent(raw));
    } catch {
      // A malformed %-escape: report it as invalid input, not a 500.
      ctx.addIssue({ code: 'custom', message: 'Malformed postcode encoding' });
      return z.NEVER;
    }
  })
  .pipe(z.string().regex(POSTCODE_REGEX));

export const AutocompleteQuerySchema = z.string().trim().min(2);
