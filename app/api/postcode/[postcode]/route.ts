import { NextResponse } from 'next/server';
import { normalizePostcode, POSTCODE_REGEX } from '@/lib/postcodes';
import { geocodePostcodeUpstream } from '@/lib/server/upstream';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postcode: string }> }
) {
  const { postcode: raw } = await params;
  const postcode = normalizePostcode(decodeURIComponent(raw));
  if (!POSTCODE_REGEX.test(postcode)) {
    return NextResponse.json({ error: 'Invalid postcode' }, { status: 400 });
  }

  try {
    const result = await geocodePostcodeUpstream(postcode);
    return NextResponse.json(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Postcode not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
