import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createPlayer, getPlayer } from '@/db/players';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ authenticated: false, registered: false });
  const profile = await getPlayer(user.userId);
  return Response.json({
    authenticated: true,
    registered: Boolean(profile?.terms_accepted_at),
    email: user.email,
    displayName: profile?.display_name ?? user.displayName,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'ChatGPT 로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
    termsAccepted?: boolean;
  };
  const displayName = body.displayName?.trim() ?? '';
  if (!body.termsAccepted) {
    return Response.json({ error: '이용 동의가 필요합니다.' }, { status: 400 });
  }
  if (!/^[가-힣a-zA-Z0-9_ ]{2,16}$/.test(displayName)) {
    return Response.json({ error: '닉네임은 한글, 영문, 숫자로 2~16자까지 입력하세요.' }, { status: 400 });
  }
  const result = await createPlayer(user, displayName);
  if (!result.profile) return Response.json({ error: '계정을 만들지 못했습니다.' }, { status: 500 });
  return Response.json({ created: result.created, displayName: result.profile.display_name });
}
