import { NextResponse } from 'next/server';
import { fetchCrimesUpstream } from '@/lib/server/upstream';

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
    const message = reason instanceof Error ? reason.message : 'Crime lookup failed';
    const status = /too many crimes/i.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
