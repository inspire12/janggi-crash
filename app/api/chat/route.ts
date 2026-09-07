import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDatabase } from '@/db';

type Match = { cho_user_id: string; han_user_id: string };
async function context(matchId: string) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const match = await getDatabase().prepare(
    'SELECT cho_user_id, han_user_id FROM matches WHERE id = ? AND (cho_user_id = ? OR han_user_id = ?)',
  ).bind(matchId, user.userId, user.userId).first<Match>();
  if (!match) return null;
  return { user, match, opponentId: match.cho_user_id === user.userId ? match.han_user_id : match.cho_user_id };
}

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get('matchId') ?? '';
  const current = await context(matchId);
  if (!current) return Response.json({ error: '대국을 찾을 수 없습니다.' }, { status: 404 });
  const db = getDatabase();
  const chat = await db.prepare('SELECT requester_user_id, status FROM match_chats WHERE match_id = ?').bind(matchId).first<{ requester_user_id: string; status: string }>();
  const messages = chat?.status === 'accepted' ? await db.prepare(
    `SELECT id, sender_user_id, body, created_at FROM chat_messages
     WHERE match_id = ? ORDER BY created_at ASC LIMIT 50`,
  ).bind(matchId).all() : { results: [] };
  return Response.json({ status: chat?.status ?? 'closed', requestedByMe: chat?.requester_user_id === current.user.userId, messages: messages.results });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { matchId?: string; action?: string; message?: string };
  const current = await context(body.matchId ?? '');
  if (!current) return Response.json({ error: '대국을 찾을 수 없습니다.' }, { status: 404 });
  const db = getDatabase();
  const blocked = await db.prepare(
    `SELECT 1 FROM blocked_players WHERE
     (blocker_user_id = ? AND blocked_user_id = ?) OR
     (blocker_user_id = ? AND blocked_user_id = ?) LIMIT 1`,
  ).bind(current.user.userId, current.opponentId, current.opponentId, current.user.userId).first();
  if (blocked) return Response.json({ error: '차단된 상대와는 채팅할 수 없습니다.' }, { status: 403 });
  if (body.action === 'request') {
    await db.prepare(
      `INSERT INTO match_chats (match_id, requester_user_id, status, updated_at)
       VALUES (?, ?, 'pending', ?) ON CONFLICT(match_id) DO NOTHING`,
    ).bind(body.matchId, current.user.userId, Date.now()).run();
    return Response.json({ ok: true });
  }
  if (body.action === 'accept' || body.action === 'reject') {
    const status = body.action === 'accept' ? 'accepted' : 'rejected';
    const result = await db.prepare(
      `UPDATE match_chats SET status = ?, updated_at = ?
       WHERE match_id = ? AND requester_user_id != ? AND status = 'pending'`,
    ).bind(status, Date.now(), body.matchId, current.user.userId).run();
    if (result.meta.changes !== 1) return Response.json({ error: '처리할 채팅 요청이 없습니다.' }, { status: 409 });
    return Response.json({ ok: true });
  }
  if (body.action === 'send') {
    const message = body.message?.trim() ?? '';
    if (!message || message.length > 200) return Response.json({ error: '메시지는 1~200자로 입력하세요.' }, { status: 400 });
    const accepted = await db.prepare("SELECT 1 FROM match_chats WHERE match_id = ? AND status = 'accepted'").bind(body.matchId).first();
    if (!accepted) return Response.json({ error: '상대가 채팅을 수락해야 합니다.' }, { status: 403 });
    await db.prepare('INSERT INTO chat_messages (match_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?)').bind(body.matchId, current.user.userId, message, Date.now()).run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
}
