import { NextResponse } from 'next/server';
import { autocompletePostcodesUpstream } from '@/lib/server/upstream';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();
  if (query.length < 2) {
    return NextResponse.json({ result: [] });
  }

  try {
    const result = await autocompletePostcodesUpstream(query);
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ result: [] });
  }
}
