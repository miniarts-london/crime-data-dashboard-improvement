import { NextResponse } from 'next/server';
import { fetchCrimesUpstream, UpstreamError } from '@/lib/server/upstream';

const MONTH_REGEX = /^\d{4}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const date = searchParams.get('date') ?? '';

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: 'Invalid lat' }, { status: 400 });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid lng' }, { status: 400 });
  }
  if (date && !MONTH_REGEX.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

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
