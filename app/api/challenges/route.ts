import { getAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import { getDatabase } from '@/db';

export async function GET() {
  const user=await getAppUser();
  if(!user) return Response.json({error:'로그인이 필요합니다.'},{status:401});
  const rows=await getDatabase().prepare(`SELECT c.id,c.sender,c.recipient,c.time_control,c.status,c.match_id,c.expires_at,p.display_name,
    c.sender=? AS outgoing FROM friend_challenges c JOIN players p ON p.id=CASE WHEN c.sender=? THEN c.recipient ELSE c.sender END
    WHERE (c.sender=? OR c.recipient=?) AND ((c.status='pending' AND c.expires_at>?) OR
      (c.status='accepted' AND EXISTS(SELECT 1 FROM matches m WHERE m.id=c.match_id AND m.status='active')))
    ORDER BY c.created_at DESC LIMIT 30`).bind(user.userId,user.userId,user.userId,user.userId,Date.now()).all();
  return Response.json({challenges:rows.results},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request:Request) {
  const user=await getAppUser();
  if(!user) return Response.json({error:'로그인이 필요합니다.'},{status:401});
  if(!(await getPlayer(user.userId))?.terms_accepted_at) return Response.json({error:'계정 설정이 필요합니다.'},{status:403});
  const body=await request.json().catch(()=>null) as {action?:string;userId?:string;id?:string;formation?:unknown;timeControl?:string}|null;
  if(!body) return Response.json({error:'잘못된 요청입니다.'},{status:400});
  const fail=(error:string,status=409)=>Response.json({error},{status});
  return getDatabase().transaction(async db=>{
    const now=Date.now();
    await db.prepare('DELETE FROM matchmaking_queue WHERE expires_at<=?').bind(now).run();
    await db.prepare("UPDATE friend_challenges SET status='expired' WHERE status='pending' AND expires_at<=?").bind(now).run();
    await db.prepare("UPDATE match_offers SET status='expired' WHERE status='pending' AND expires_at<=?").bind(now).run();
    if(body.action==='request') {
      if(typeof body.userId!=='string'||body.userId===user.userId||!['standard','blitz'].includes(body.timeControl??''))return fail('친구와 시간을 확인해 주세요.',400);
      const target=body.userId;
      const friend=await db.prepare("SELECT 1 FROM friendships WHERE pair_key=? AND status='accepted'").bind([user.userId,target].sort().join(':')).first();
      if(!friend)return fail('친구에게만 대국을 신청할 수 있습니다.',403);
      const blocked=await db.prepare('SELECT 1 FROM blocked_players WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)').bind(user.userId,target,target,user.userId).first();
      if(blocked)return fail('차단 관계에서는 대국을 신청할 수 없습니다.',403);
      const busy=await db.prepare("SELECT 1 FROM matches WHERE status='active' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?)) UNION ALL SELECT 1 FROM matchmaking_queue WHERE user_id IN (?,?) UNION ALL SELECT 1 FROM friend_challenges WHERE status='pending' AND (sender IN (?,?) OR recipient IN (?,?)) LIMIT 1").bind(user.userId,target,user.userId,target,user.userId,target,user.userId,target,user.userId,target).first();
      if(busy)return fail('대국·매칭·대국 신청 중인 사용자가 있습니다. 기존 요청을 먼저 마쳐 주세요.');
      const offer=await db.prepare("SELECT 1 FROM match_offers WHERE status='pending' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?))").bind(user.userId,target,user.userId,target).first();
      if(offer)return fail('포진 선택 및 수락 대기 중인 사용자가 있습니다.');
      const id=crypto.randomUUID();
      await db.prepare('INSERT INTO friend_challenges(id,sender,recipient,time_control,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(id,user.userId,target,body.timeControl!,now+120000,now).run();
      return Response.json({ok:true,id});
    }
    if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return fail('신청을 확인해 주세요.',400);
    const c=await db.prepare('SELECT * FROM friend_challenges WHERE id=? AND (sender=? OR recipient=?) FOR UPDATE').bind(body.id,user.userId,user.userId).first<{id:string;sender:string;recipient:string;formation:string;time_control:'standard'|'blitz';status:string;match_id:string|null}>();
    if(!c)return fail('신청을 찾을 수 없습니다.',404);
    if(body.action==='accept' && c.recipient!==user.userId)return fail('받은 신청만 수락할 수 있습니다.',403);
    if(c.status==='accepted'&&body.action==='accept') {
      const offer=await db.prepare('SELECT id,status FROM match_offers WHERE friend_challenge_id=?').bind(c.id).first<{id:string;status:string}>();
      if(c.match_id)return Response.json({matchId:c.match_id});
      if(offer?.status==='pending')return Response.json({pending:true,offerId:offer.id});
      return fail('종료되었거나 만료된 신청입니다.');
    }
    if(c.status!=='pending')return fail('종료되었거나 만료된 신청입니다.');
    if(body.action==='cancel'||body.action==='reject') {
      if((body.action==='cancel'?c.sender:c.recipient)!==user.userId)return fail('요청 권한이 없습니다.',403);
      await db.prepare('UPDATE friend_challenges SET status=? WHERE id=?').bind(body.action==='cancel'?'cancelled':'rejected',c.id).run();
      return Response.json({ok:true});
    }
    if(body.action!=='accept')return fail('지원하지 않는 요청입니다.',400);
    const friend=await db.prepare("SELECT 1 FROM friendships WHERE pair_key=? AND status='accepted'").bind([c.sender,c.recipient].sort().join(':')).first();
    const blocked=await db.prepare('SELECT 1 FROM blocked_players WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)').bind(c.sender,c.recipient,c.recipient,c.sender).first();
    if(!friend||blocked)return fail('친구 관계 또는 차단 상태가 변경되었습니다.',403);
    const busy=await db.prepare("SELECT 1 FROM matches WHERE status='active' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?)) UNION ALL SELECT 1 FROM matchmaking_queue WHERE user_id IN (?,?) LIMIT 1").bind(c.sender,c.recipient,c.sender,c.recipient,c.sender,c.recipient).first();
    if(busy)return fail('대국 또는 매칭 중입니다. 취소 후 다시 신청해 주세요.');
    const pending=await db.prepare("SELECT 1 FROM match_offers WHERE status='pending' AND (cho_user_id IN (?,?) OR han_user_id IN (?,?))").bind(c.sender,c.recipient,c.sender,c.recipient).first();
    if(pending)return fail('포진 선택 및 수락 대기 중입니다.');
    const senderCho=crypto.getRandomValues(new Uint8Array(1))[0]%2===0;
    const cho=senderCho?c.sender:c.recipient,han=senderCho?c.recipient:c.sender;
    const id=crypto.randomUUID();
    await db.prepare('INSERT INTO match_offers(id,cho_user_id,han_user_id,time_control,expires_at,created_at,friend_challenge_id,rated) VALUES(?,?,?,?,?,?,?,false)').bind(id,cho,han,c.time_control,now+60000,now,c.id).run();
    await db.prepare("UPDATE friend_challenges SET status='accepted' WHERE id=?").bind(c.id).run();
    return Response.json({pending:true,offerId:id});
  },736421);
}
