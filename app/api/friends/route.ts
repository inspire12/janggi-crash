import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { getPlayer } from '@/db/players';

async function currentAccount() {
  const user = await getAppUser();
  if (!user) return null;
  const profile = await getPlayer(user.userId);
  return profile?.terms_accepted_at ? { user, profile } : null;
}

const pairKey = (first: string, second: string) => [first, second].sort().join(':');

export async function GET(request: Request) {
  const current = await currentAccount();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const db = getDatabase();
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (query) {
    const found = await db.prepare(
      `SELECT p.id, p.display_name, p.elo,
        CASE WHEN f.status = 'accepted' THEN 'friend'
             WHEN f.requester_user_id = ? THEN 'sent'
             WHEN f.addressee_user_id = ? THEN 'received'
             ELSE NULL END AS relationship
       FROM players p
       LEFT JOIN friendships f ON f.pair_key = CASE WHEN p.id < ? THEN p.id || ':' || ? ELSE ? || ':' || p.id END
       WHERE p.id != ? AND p.display_name LIKE ? ESCAPE '\\'
         AND NOT EXISTS (
           SELECT 1 FROM blocked_players b
           WHERE (b.blocker_user_id = ? AND b.blocked_user_id = p.id)
              OR (b.blocker_user_id = p.id AND b.blocked_user_id = ?)
         )
       ORDER BY CASE WHEN p.display_name = ? THEN 0 ELSE 1 END, p.elo DESC
       LIMIT 10`,
    ).bind(
      current.user.userId, current.user.userId,
      current.user.userId, current.user.userId, current.user.userId,
      current.user.userId, `%${query.replace(/[\\%_]/g, '\\$&')}%`,
      current.user.userId, current.user.userId, query,
    ).all();
    return Response.json({ results: found.results });
  }

  const rows = await db.prepare(
    `SELECT f.pair_key, f.requester_user_id, f.addressee_user_id, f.status,
      p.id, p.display_name, p.elo
     FROM friendships f
     JOIN players p ON p.id = CASE WHEN f.requester_user_id = ? THEN f.addressee_user_id ELSE f.requester_user_id END
     WHERE f.requester_user_id = ? OR f.addressee_user_id = ?
     ORDER BY f.updated_at DESC`,
  ).bind(current.user.userId, current.user.userId, current.user.userId).all<{
    pair_key: string; requester_user_id: string; addressee_user_id: string;
    status: string; id: string; display_name: string; elo: number;
  }>();

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const row of rows.results) {
    const player = { id: row.id, displayName: row.display_name, elo: row.elo };
    if (row.status === 'accepted') friends.push(player);
    else if (row.addressee_user_id === current.user.userId) incoming.push(player);
    else outgoing.push(player);
  }
  return Response.json({ friends, incoming, outgoing });
}

export async function POST(request: Request) {
  const current = await currentAccount();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; userId?: string };
  if (!body.userId || body.userId === current.user.userId) {
    return Response.json({ error: '올바른 사용자를 선택하세요.' }, { status: 400 });
  }
  const db = getDatabase();
  const key = pairKey(current.user.userId, body.userId);

  if (body.action === 'request') {
    const target = await db.prepare('SELECT id FROM players WHERE id = ?').bind(body.userId).first();
    if (!target) return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    const blocked = await db.prepare(
      `SELECT 1 FROM blocked_players WHERE
       (blocker_user_id = ? AND blocked_user_id = ?) OR
       (blocker_user_id = ? AND blocked_user_id = ?) LIMIT 1`,
    ).bind(current.user.userId, body.userId, body.userId, current.user.userId).first();
    if (blocked) return Response.json({ error: '차단 관계에서는 친구 요청을 보낼 수 없습니다.' }, { status: 403 });
    try {
      const now = Date.now();
      await db.prepare(
        `INSERT INTO friendships (pair_key, requester_user_id, addressee_user_id, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
      ).bind(key, current.user.userId, body.userId, now, now).run();
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: '이미 친구이거나 요청을 보낸 사용자입니다.' }, { status: 409 });
    }
  }

  if (body.action === 'accept') {
    const result = await db.prepare(
      `UPDATE friendships SET status = 'accepted', updated_at = ?
       WHERE pair_key = ? AND addressee_user_id = ? AND status = 'pending'`,
    ).bind(Date.now(), key, current.user.userId).run();
    if (!result.meta.changes) return Response.json({ error: '수락할 요청이 없습니다.' }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body.action === 'reject' || body.action === 'cancel' || body.action === 'remove') {
    let condition = '(requester_user_id = ? OR addressee_user_id = ?)';
    if (body.action === 'reject') condition = "addressee_user_id = ? AND status = 'pending'";
    if (body.action === 'cancel') condition = "requester_user_id = ? AND status = 'pending'";
    const bindings = body.action === 'remove'
      ? [key, current.user.userId, current.user.userId]
      : [key, current.user.userId];
    await db.prepare(`DELETE FROM friendships WHERE pair_key = ? AND ${condition}`).bind(...bindings).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
}
