import { NextResponse } from 'next/server';
import { fetchCrimesUpstream, UpstreamError } from '@/lib/server/upstream';
import { CrimesQuerySchema } from '@/lib/schemas';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = CrimesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    // Name the first bad field (lat / lng / date), matching the old messages.
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json({ error: `Invalid ${String(field ?? 'query')}` }, { status: 400 });
  }
  const { lat, lng, date = '' } = parsed.data;

  try {
    const crimes = await fetchCrimesUpstream(lat, lng, date);
    return NextResponse.json(crimes);
  } catch (reason) {
    // UpstreamError carries the real status the upstream API returned (e.g.
    // 503 for "too many crimes"), set at the point upstream.ts actually
    // knows it - not guessed here from the error message's wording.
    if (reason instanceof UpstreamError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    const message = reason instanceof Error ? reason.message : 'Crime lookup failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
