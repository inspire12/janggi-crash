import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { createInitialPieces, isFormation } from '@/lib/janggi';
import { timeControls } from '@/lib/game-clock';

type RequestRow = { requested_by: string; status: string; expires_at: number; next_match_id: string | null };
type Match = { id:string; cho_user_id:string; han_user_id:string; status:string; cho_formation:string; han_formation:string; time_control:string };

async function handle(request: Request, write: boolean) {
  const user = await getAppUser();
  if (!user) return Response.json({error:'로그인이 필요합니다.'},{status:401});
  const raw = write ? await request.json().catch(()=>null) : {};
  if (!raw || typeof raw !== 'object') return Response.json({error:'잘못된 요청입니다.'},{status:400});
  const body = raw as {matchId?:unknown; action?:string};
  const id = write ? body.matchId : new URL(request.url).searchParams.get('id');
  if (typeof id !== 'string' || !id) return Response.json({error:'대국 ID가 필요합니다.'},{status:400});
  return getDatabase().transaction(async db => {
    const match = await db.prepare('SELECT id,cho_user_id,han_user_id,status,cho_formation,han_formation,time_control FROM matches WHERE id=? AND (cho_user_id=? OR han_user_id=?)').bind(id,user.userId,user.userId).first<Match>();
    if (!match) return Response.json({error:'대국을 찾을 수 없습니다.'},{status:404});
    const row = await db.prepare('SELECT requested_by,status,expires_at,next_match_id FROM rematch_requests WHERE match_id=?').bind(id).first<RequestRow>();
    const present = () => Response.json({status:row?.status === 'pending' && Number(row.expires_at)<=Date.now() ? 'expired' : row?.status ?? 'none', requestedByMe:row?.requested_by===user.userId, matchId:row?.next_match_id ?? null});
    if (!write) return present();
    if (match.status !== 'finished') return Response.json({error:'대국 종료 후 신청할 수 있습니다.'},{status:409});
    if (!body.action || !['request','accept','decline','cancel'].includes(body.action)) return Response.json({error:'지원하지 않는 요청입니다.'},{status:400});
    if (row?.status === 'accepted') return present();
    const pending = row?.status === 'pending' && Number(row.expires_at)>Date.now();
    if (body.action==='decline' || body.action==='cancel') {
      if (!pending || (body.action==='cancel') !== (row?.requested_by===user.userId)) return Response.json({error:'처리할 요청이 없습니다.'},{status:409});
      await db.prepare('UPDATE rematch_requests SET status=? WHERE match_id=?').bind(body.action==='cancel'?'cancelled':'declined',id).run();
      return Response.json({ok:true});
    }
    const opponent = match.cho_user_id===user.userId ? match.han_user_id : match.cho_user_id;
    const blocked = await db.prepare('SELECT 1 FROM blocked_players WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)').bind(user.userId,opponent,opponent,user.userId).first();
    if (blocked) return Response.json({error:'차단 관계에서는 재대국할 수 없습니다.'},{status:403});
    const active = await db.prepare("SELECT id FROM matches WHERE status='active' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?)) LIMIT 1").bind(user.userId,opponent,user.userId,opponent).first();
    if (active) return Response.json({error:'참가자가 다른 대국을 진행 중입니다.'},{status:409});
    const preparing=await db.prepare("SELECT 1 FROM match_offers WHERE status='pending' AND expires_at>? AND (cho_user_id IN (?,?) OR han_user_id IN (?,?)) UNION ALL SELECT 1 FROM friend_challenges WHERE status='pending' AND expires_at>? AND (sender IN (?,?) OR recipient IN (?,?)) LIMIT 1").bind(Date.now(),user.userId,opponent,user.userId,opponent,Date.now(),user.userId,opponent,user.userId,opponent).first();
    if(preparing)return Response.json({error:'다른 대국 신청 또는 수락을 먼저 마쳐 주세요.'},{status:409});
    if (body.action==='request') {
      if (pending) return present();
      // One invitation per finished game: declining/cancelling cannot be spammed.
      if (row) return Response.json({error:'재대국 요청이 종료되었습니다. 로비에서 새 대국을 시작해 주세요.'},{status:409});
      await db.prepare("INSERT INTO rematch_requests(match_id,requested_by,status,expires_at) VALUES (?,?,'pending',?)").bind(id,user.userId,Date.now()+120000).run();
      return Response.json({ok:true});
    }
    if (!pending || row?.requested_by===user.userId) return Response.json({error:'수락할 요청이 없거나 만료되었습니다.'},{status:409});
    const next = crypto.randomUUID(), now=Date.now();
    const fallback='horse-elephant-elephant-horse';
    const choFormation=isFormation(match.han_formation)?match.han_formation:fallback;
    const hanFormation=isFormation(match.cho_formation)?match.cho_formation:fallback;
    const control=match.time_control==='blitz'?'blitz':'standard';
    const board=JSON.stringify(createInitialPieces(choFormation,hanFormation));
    await db.prepare(`INSERT INTO matches (id,cho_user_id,han_user_id,status,turn,board_json,version,cho_time_ms,han_time_ms,turn_started_at,created_at,updated_at,initial_board_json,cho_formation,han_formation,rules_version,time_control,rated)
      VALUES (?,?,?,'active','cho',?,0,?,?,?,?,?,?,?,?,'janggi-clash-v2',?,false)`).bind(next,match.han_user_id,match.cho_user_id,board,timeControls[control].mainMs,timeControls[control].mainMs,now,now,now,board,choFormation,hanFormation,control).run();
    await db.prepare('DELETE FROM matchmaking_queue WHERE user_id IN (?,?)').bind(user.userId,opponent).run();
    await db.prepare("UPDATE rematch_requests SET status='accepted',next_match_id=? WHERE match_id=?").bind(next,id).run();
    return Response.json({matchId:next});
  },736421);
}
export const GET = (request:Request) => handle(request,false);
export const POST = (request:Request) => handle(request,true);
