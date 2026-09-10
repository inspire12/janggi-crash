import { getAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import { getDatabase } from '@/db';
import { rankForScore } from '@/lib/rating';

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) return Response.json({ registered: false }, { status: 404 });
  const games = profile.wins + profile.losses + profile.draws;
  return Response.json({
    registered: true,
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    elo: profile.elo,
    wins: profile.wins,
    losses: profile.losses,
    draws: profile.draws,
    streak: profile.streak,
    allowTakebackRequests: profile.allow_takeback_requests === 1,
    games,
    winRate: games ? Math.round((profile.wins / games) * 100) : 0,
    rank: rankForScore(profile.rank_score),
  });
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) {
    return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { allowTakebackRequests?: boolean; displayName?: unknown } | null;
  if (!body || typeof body !== 'object') return Response.json({ error: '올바른 설정값이 필요합니다.' }, { status: 400 });
  if ('displayName' in body) {
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!/^[가-힣a-zA-Z0-9_ ]{2,16}$/.test(displayName)) {
      return Response.json({ error: '닉네임은 한글, 영문, 숫자, 밑줄, 공백으로 2~16자까지 입력하세요.' }, { status: 400 });
    }
    let result;
    try {
      result = await getDatabase().prepare('UPDATE players SET display_name = ?, updated_at = ? WHERE id = ?').bind(displayName, Date.now(), user.userId).run();
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505') return Response.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 });
      return Response.json({ error: '닉네임을 저장하지 못했습니다.' }, { status: 500 });
    }
    if (!result.success || result.meta.changes !== 1) return Response.json({ error: '닉네임을 저장하지 못했습니다.' }, { status: 500 });
    return Response.json({ displayName });
  }
  if (typeof body.allowTakebackRequests !== 'boolean') {
    return Response.json({ error: '올바른 설정값이 필요합니다.' }, { status: 400 });
  }
  const now = Date.now();
  const db = getDatabase();
  const statements = [
    db.prepare(
      'UPDATE players SET allow_takeback_requests = ?, updated_at = ? WHERE id = ?',
    ).bind(body.allowTakebackRequests ? 1 : 0, now, user.userId),
  ];
  if (!body.allowTakebackRequests) {
    statements.push(
      db.prepare(
        `UPDATE matches SET takeback_requested_by = NULL, updated_at = ?
         WHERE status = 'active' AND takeback_requested_by IS NOT NULL
           AND takeback_requested_by != ? AND (cho_user_id = ? OR han_user_id = ?)`,
      ).bind(now, user.userId, user.userId, user.userId),
    );
  }
  const results = await db.batch(statements);
  if (!results[0].success || results[0].meta.changes !== 1) {
    return Response.json({ error: '설정을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ allowTakebackRequests: body.allowTakebackRequests });
}
