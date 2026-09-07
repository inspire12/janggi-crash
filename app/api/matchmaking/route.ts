import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDatabase } from '@/db';
import { getPlayer } from '@/db/players';
import { initialPieces } from '@/lib/janggi';

type ActiveMatch = { id: string };
type QueueOpponent = { user_id: string; elo: number };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const db = getDatabase();
  const active = await db
    .prepare(
      `SELECT id FROM matches
       WHERE status = 'active' AND (cho_user_id = ? OR han_user_id = ?)
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(user.userId, user.userId)
    .first<ActiveMatch>();
  const queued = await db
    .prepare('SELECT user_id FROM matchmaking_queue WHERE user_id = ?')
    .bind(user.userId)
    .first();
  return Response.json({ matchId: active?.id ?? null, queued: Boolean(queued) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const db = getDatabase();

  if (body.action === 'cancel') {
    await db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(user.userId).run();
    return Response.json({ queued: false, matchId: null });
  }
  if (body.action !== 'join') {
    return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
  }

  const active = await db
    .prepare(
      `SELECT id FROM matches
       WHERE status = 'active' AND (cho_user_id = ? OR han_user_id = ?)
       LIMIT 1`,
    )
    .bind(user.userId, user.userId)
    .first<ActiveMatch>();
  if (active) return Response.json({ queued: false, matchId: active.id });

  const opponent = await db
    .prepare(
      `SELECT user_id, elo FROM matchmaking_queue
       WHERE user_id != ?
       ORDER BY ABS(elo - ?), joined_at
       LIMIT 1`,
    )
    .bind(user.userId, profile.elo)
    .first<QueueOpponent>();
  if (!opponent) {
    await db
      .prepare(
        `INSERT INTO matchmaking_queue (user_id, elo, joined_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET elo = excluded.elo, joined_at = excluded.joined_at`,
      )
      .bind(user.userId, profile.elo, Date.now())
      .run();
    return Response.json({ queued: true, matchId: null });
  }

  const matchId = crypto.randomUUID();
  const userIsCho = crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0;
  const cho = userIsCho ? user.userId : opponent.user_id;
  const han = userIsCho ? opponent.user_id : user.userId;
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO matches
         (id, cho_user_id, han_user_id, status, turn, board_json, version,
          cho_time_ms, han_time_ms, turn_started_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', 'cho', ?, 0, 600000, 600000, ?, ?, ?)`,
      )
      .bind(matchId, cho, han, JSON.stringify(initialPieces), now, now, now),
    db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(user.userId),
    db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(opponent.user_id),
  ]);
  return Response.json({ queued: false, matchId });
}
