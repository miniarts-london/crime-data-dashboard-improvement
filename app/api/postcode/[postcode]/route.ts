import { NextResponse } from 'next/server';
import { PostcodeParamSchema } from '@/lib/schemas';
import { geocodePostcodeUpstream } from '@/lib/server/upstream';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postcode: string }> }
) {
  const { postcode: raw } = await params;
  const parsed = PostcodeParamSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid postcode' }, { status: 400 });
  }
  const postcode = parsed.data;

  try {
    const result = await geocodePostcodeUpstream(postcode);
    return NextResponse.json(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Postcode not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
