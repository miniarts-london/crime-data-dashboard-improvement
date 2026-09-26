import { NextResponse } from 'next/server';
import { autocompletePostcodesUpstream } from '@/lib/server/upstream';
import { AutocompleteQuerySchema } from '@/lib/schemas';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = AutocompleteQuerySchema.safeParse(searchParams.get('q') ?? '');
  if (!parsed.success) {
    return NextResponse.json({ result: [] });
  }
  const query = parsed.data;

  try {
    const result = await autocompletePostcodesUpstream(query);
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ result: [] });
  }
}
