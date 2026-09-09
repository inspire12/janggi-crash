import { authClient } from '@/app/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code && !url.searchParams.has('error')) {
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL('/lobby', url.origin));
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }
  }
  return NextResponse.redirect(new URL('/login?error=kakao', url.origin));
}
