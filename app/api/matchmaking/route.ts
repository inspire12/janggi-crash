import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { getPlayer } from '@/db/players';
import { createInitialPieces, isFormation, type Formation } from '@/lib/janggi';
import { timeControls, type TimeControl } from '@/lib/game-clock';
import { rankForScore } from '@/lib/rating';

type ActiveMatch = { id: string };
type QueueOpponent = { user_id: string; elo: number; formation: string };
type Offer = {id:string;cho_user_id:string;han_user_id:string;cho_formation:Formation|null;han_formation:Formation|null;time_control:TimeControl;status:string;expires_at:number;match_id:string|null;rated:boolean;friend_challenge_id:string|null};

export async function GET() {
  const user = await getAppUser();
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
    .prepare('SELECT user_id, time_control FROM matchmaking_queue WHERE user_id = ? AND expires_at > ?')
    .bind(user.userId, Date.now())
    .first<{ user_id: string; time_control: TimeControl }>();
  const offer = await db.prepare("SELECT * FROM match_offers WHERE (cho_user_id=? OR han_user_id=?) AND status='pending' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(user.userId,user.userId,Date.now()).first<Offer>();
  const opponent = !active && offer ? await db.prepare('SELECT display_name,elo,rank_score,wins,losses,draws FROM players WHERE id=?')
    .bind(offer.cho_user_id===user.userId?offer.han_user_id:offer.cho_user_id)
    .first<{display_name:string;elo:number;rank_score:number;wins:number;losses:number;draws:number}>() : null;
  const opponentInfo = opponent ? {displayName:opponent.display_name,elo:opponent.elo,rank:rankForScore(opponent.rank_score).name,wins:opponent.wins,losses:opponent.losses,draws:opponent.draws} : null;
  return Response.json({ matchId: active?.id ?? null, queued: Boolean(queued), timeControl: offer?.time_control ?? queued?.time_control ?? null,
    offer: !active && offer ? {id:offer.id, rated:offer.rated, opponent:opponentInfo, expiresAt:Number(offer.expires_at), serverNow:Date.now(), formation:offer.cho_user_id===user.userId?offer.cho_formation:offer.han_formation, accepted:Boolean(offer.cho_user_id===user.userId?offer.cho_formation:offer.han_formation), opponentAccepted:Boolean(offer.cho_user_id===user.userId?offer.han_formation:offer.cho_formation)} : null },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; formation?: unknown; timeControl?: unknown; offerId?:string } | null;
  if (!body) return Response.json({error:'잘못된 요청입니다.'},{status:400});
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const db = getDatabase();

  return db.transaction(async db => {
  await db.prepare('DELETE FROM matchmaking_queue WHERE expires_at <= ?').bind(Date.now()).run();
  await db.prepare("UPDATE match_offers SET status='expired' WHERE status='pending' AND expires_at<=?").bind(Date.now()).run();
  if (body.action==='accept' || body.action==='decline') {
    if (typeof body.offerId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.offerId)) return Response.json({error:'매칭을 확인해 주세요.'},{status:400});
    const offer=await db.prepare('SELECT * FROM match_offers WHERE id=? AND (cho_user_id=? OR han_user_id=?)').bind(body.offerId,user.userId,user.userId).first<Offer>();
    if (!offer) return Response.json({error:'매칭을 찾을 수 없습니다.'},{status:404});
    if (offer.status==='accepted') return Response.json({matchId:offer.match_id});
    if (offer.status!=='pending') return Response.json({error:'거절되었거나 만료된 매칭입니다.'},{status:409});
    if (body.action==='decline') {
      await db.prepare("UPDATE match_offers SET status='declined' WHERE id=?").bind(offer.id).run();
      return Response.json({queued:false});
    }
    if (!isFormation(body.formation)) return Response.json({error:'포진을 선택해 주세요.'},{status:400});
    const busy=await db.prepare("SELECT 1 FROM matches WHERE status='active' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?))").bind(offer.cho_user_id,offer.han_user_id,offer.cho_user_id,offer.han_user_id).first();
    const blocked=await db.prepare('SELECT 1 FROM blocked_players WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)').bind(offer.cho_user_id,offer.han_user_id,offer.han_user_id,offer.cho_user_id).first();
    const stillFriends=!offer.friend_challenge_id || await db.prepare("SELECT 1 FROM friendships WHERE pair_key=? AND status='accepted'").bind([offer.cho_user_id,offer.han_user_id].sort().join(':')).first();
    if (busy || blocked || !stillFriends) {
      await db.prepare("UPDATE match_offers SET status='declined' WHERE id=?").bind(offer.id).run();
      return Response.json({error:'상대의 대국 또는 차단 상태가 변경되었습니다.'},{status:409});
    }
    const column=offer.cho_user_id===user.userId?'cho_formation':'han_formation';
    // Acknowledged formations are immutable; a retry cannot change them.
    if (!offer[column]) {
      await db.prepare(`UPDATE match_offers SET ${column}=? WHERE id=?`).bind(body.formation,offer.id).run();
      offer[column]=body.formation;
    }
    if (!offer.cho_formation || !offer.han_formation) return Response.json({waiting:true});
    const id=crypto.randomUUID(),now=Date.now(),mainMs=timeControls[offer.time_control].mainMs;
    const board=JSON.stringify(createInitialPieces(offer.cho_formation,offer.han_formation));
    await db.prepare(`INSERT INTO matches (id,cho_user_id,han_user_id,status,turn,board_json,version,cho_time_ms,han_time_ms,turn_started_at,created_at,updated_at,initial_board_json,cho_formation,han_formation,rules_version,time_control,rated)
      VALUES (?,?,?,'active','cho',?,0,?,?,?,?,?,?,?,?,'janggi-clash-v2',?,?)`).bind(id,offer.cho_user_id,offer.han_user_id,board,mainMs,mainMs,now,now,now,board,offer.cho_formation,offer.han_formation,offer.time_control,offer.rated).run();
    if(offer.friend_challenge_id)await db.prepare('UPDATE friend_challenges SET match_id=? WHERE id=?').bind(id,offer.friend_challenge_id).run();
    await db.prepare("UPDATE match_offers SET status='accepted',match_id=? WHERE id=?").bind(id,offer.id).run();
    await db.prepare('DELETE FROM matchmaking_queue WHERE user_id IN (?,?)').bind(offer.cho_user_id,offer.han_user_id).run();
    return Response.json({matchId:id});
  }
  if (body.action === 'cancel') {
    await db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(user.userId).run();
    return Response.json({ queued: false, matchId: null });
  }
  if (body.action !== 'join') {
    return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
  }
  const timeControl = body.timeControl ?? 'standard';
  if (timeControl !== 'standard' && timeControl !== 'blitz') return Response.json({ error: '올바른 대국 시간을 선택해 주세요.' }, { status: 400 });

  const active = await db
    .prepare(
      `SELECT id FROM matches
       WHERE status = 'active' AND (cho_user_id = ? OR han_user_id = ?)
       LIMIT 1`,
    )
    .bind(user.userId, user.userId)
    .first<ActiveMatch>();
  if (active) return Response.json({ queued: false, matchId: active.id });
  const pending=await db.prepare("SELECT id FROM match_offers WHERE status='pending' AND (cho_user_id=? OR han_user_id=?)").bind(user.userId,user.userId).first();
  if (pending) return Response.json({queued:false,pending:true});
  const friendRequest=await db.prepare("SELECT 1 FROM friend_challenges WHERE status='pending' AND expires_at>? AND (sender=? OR recipient=?)").bind(Date.now(),user.userId,user.userId).first();
  if(friendRequest)return Response.json({error:'친구 대국 신청을 먼저 취소하거나 응답해 주세요.'},{status:409});

  const opponent = await db
    .prepare(
      `SELECT user_id, elo, formation FROM matchmaking_queue
       WHERE user_id != ? AND time_control = ? AND expires_at > ?
         AND NOT EXISTS (SELECT 1 FROM match_offers o WHERE o.status='pending' AND (o.cho_user_id=matchmaking_queue.user_id OR o.han_user_id=matchmaking_queue.user_id))
         AND NOT EXISTS (SELECT 1 FROM friend_challenges c WHERE c.status='pending' AND c.expires_at>? AND (c.sender=matchmaking_queue.user_id OR c.recipient=matchmaking_queue.user_id))
         AND NOT EXISTS (SELECT 1 FROM blocked_players b WHERE (b.blocker_user_id=? AND b.blocked_user_id=matchmaking_queue.user_id) OR (b.blocked_user_id=? AND b.blocker_user_id=matchmaking_queue.user_id))
         AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.status='active'
           AND (m.cho_user_id=matchmaking_queue.user_id OR m.han_user_id=matchmaking_queue.user_id))
       ORDER BY ABS(elo - ?), joined_at
       LIMIT 1`,
    )
    .bind(user.userId, timeControl, Date.now(), Date.now(),user.userId,user.userId,profile.elo)
    .first<QueueOpponent>();
  if (!opponent) {
    await db
      .prepare(
        `INSERT INTO matchmaking_queue (user_id, elo, formation, joined_at, time_control, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET elo = excluded.elo, formation = excluded.formation, joined_at = excluded.joined_at, time_control = excluded.time_control, expires_at=excluded.expires_at`,
      )
      .bind(user.userId, profile.elo, 'horse-elephant-elephant-horse', Date.now(), timeControl, Date.now()+90000)
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
        `INSERT INTO match_offers(id,cho_user_id,han_user_id,time_control,expires_at,created_at) VALUES (?,?,?,?,?,?)`,
      )
      .bind(matchId, cho, han, timeControl, now+60000, now),
    db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(user.userId),
    db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?').bind(opponent.user_id),
  ]);
  return Response.json({ queued: false, pending:true });
  }, 736421);
}
