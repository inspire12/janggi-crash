import { authClient } from '@/app/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; token?: unknown } | null;
  if (typeof body?.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return Response.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400 });
  }
  const client = await authClient();
  if (body.token !== undefined) {
    if (typeof body.token !== 'string' || !/^\d{6,10}$/.test(body.token)) return Response.json({ error: '인증번호를 확인해 주세요.' }, { status: 400 });
    const { error } = await client.auth.verifyOtp({ email: body.email, token: body.token, type: 'email' });
    if (error) return Response.json({ error: '인증번호가 만료되었거나 올바르지 않습니다.' }, { status: 400 });
  } else {
    const { error } = await client.auth.signInWithOtp({ email: body.email, options: { shouldCreateUser: true } });
    if (error) return Response.json({ error: '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  const client = await authClient();
  const { error } = await client.auth.signOut();
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
