import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getPlayer } from '@/db/players';
import { getDatabase } from '@/db';
import { rankForElo } from '@/lib/rating';

export async function GET() {
  const user = await getChatGPTUser();
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
    rank: rankForElo(profile.elo),
  });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) {
    return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { allowTakebackRequests?: boolean };
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
