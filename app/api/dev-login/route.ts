import { authClient } from '@/app/auth';
import { localTestingEnabled } from '@/lib/local-testing';

export async function POST(request: Request) {
  if (!localTestingEnabled()) return new Response(null, { status: 404 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null) as { slot?: unknown; password?: unknown } | null;
  if (!body || (body.slot !== 'a' && body.slot !== 'b') || typeof body.password !== 'string' || body.password.length > 128) {
    return Response.json({ error: '테스트 계정과 암호를 확인하세요.' }, { status: 400 });
  }
  const client = await authClient();
  const { error } = await client.auth.signInWithPassword({ email: `tester-${body.slot}@janggi.test`, password: body.password });
  return Response.json(error ? { error: '테스트 계정과 암호를 확인하세요.' } : { ok: true }, { status: error ? 401 : 200, headers: { 'Cache-Control': 'no-store' } });
}
