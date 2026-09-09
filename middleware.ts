import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from 'cloudflare:workers';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
      return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    }
  }
  let response = NextResponse.next({ request });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return response;
  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/api/:path*', '/lobby/:path*', '/battle/:path*', '/join', '/login'] };
