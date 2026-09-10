import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { getPlayer } from '@/db/players';

async function account() {
  const user = await getAppUser();
  if (!user) return null;
  const profile = await getPlayer(user.userId);
  return profile?.terms_accepted_at ? { user, profile } : null;
}

export async function GET() {
  const current = await account();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const db = getDatabase();
  const guild = await db.prepare(
    `SELECT g.id, g.name, gm.role,
      (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) AS member_count
     FROM guild_members gm JOIN guilds g ON g.id = gm.guild_id WHERE gm.user_id = ?`,
  ).bind(current.user.userId).first();
  const blocked = await db.prepare(
    `SELECT p.id, p.display_name FROM blocked_players b
     JOIN players p ON p.id = b.blocked_user_id
     WHERE b.blocker_user_id = ? ORDER BY b.created_at DESC`,
  ).bind(current.user.userId).all();
  return Response.json({ guild: guild ?? null, blocked: blocked.results });
}

export async function POST(request: Request) {
  const current = await account();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; name?: string; userId?: string };
  const db = getDatabase();
  if (body.action === 'create-guild') {
    const name = body.name?.trim() ?? '';
    if (!/^[가-힣a-zA-Z0-9 _-]{2,16}$/.test(name)) return Response.json({ error: '길드명은 2~16자로 입력하세요.' }, { status: 400 });
    const existing = await db.prepare('SELECT user_id FROM guild_members WHERE user_id = ?').bind(current.user.userId).first();
    if (existing) return Response.json({ error: '이미 길드에 소속되어 있습니다.' }, { status: 409 });
    const id = crypto.randomUUID();
    const now = Date.now();
    try {
      await db.batch([
        db.prepare('INSERT INTO guilds (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)').bind(id, name, current.user.userId, now),
        db.prepare("INSERT INTO guild_members (user_id, guild_id, role, joined_at) VALUES (?, ?, 'owner', ?)").bind(current.user.userId, id, now),
      ]);
    } catch {
      return Response.json({ error: '이미 사용 중인 길드명입니다.' }, { status: 409 });
    }
    return Response.json({ ok: true, guildId: id });
  }
  if ((body.action === 'block' || body.action === 'unblock') && body.userId && body.userId !== current.user.userId) {
    const targetId=body.userId;
    return db.transaction(async db => {
    if (body.action === 'block') await db.prepare(
      'INSERT INTO blocked_players (blocker_user_id, blocked_user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    ).bind(current.user.userId, targetId, Date.now()).run();
    else await db.prepare('DELETE FROM blocked_players WHERE blocker_user_id = ? AND blocked_user_id = ?').bind(current.user.userId, targetId).run();
    return Response.json({ ok: true });
    },736421);
  }
  return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
}
