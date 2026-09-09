import { authClient } from '@/app/auth';
import { env } from 'cloudflare:workers';

export async function POST(request: Request) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Missing configuration');
    const settingsResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(5000),
    });
    if (!settingsResponse.ok) throw new Error('Auth settings unavailable');
    const settings = await settingsResponse.json() as { external?: { kakao?: boolean } };
    if (!settings.external?.kakao) return Response.json({ error: '카카오 로그인 연결을 준비 중입니다. 잠시 후 다시 이용해 주세요.' }, { status: 503 });
    const client = await authClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        // `scopes` appends to Kakao defaults; the provider query parameter replaces them.
        queryParams: { scope: 'profile_nickname' },
        redirectTo: new URL('/api/auth/callback', request.url).toString(),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error('OAuth initiation failed');
    return Response.json({ url: data.url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '로그인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}

export async function DELETE() {
  const client = await authClient();
  const { error } = await client.auth.signOut();
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
