import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
export async function POST() {
  const user=await getAppUser();
  if(!user)return new Response(null,{status:401});
  const db=getDatabase(),now=Date.now();
  await db.batch([
    db.prepare('UPDATE players SET last_seen_at=? WHERE id=? AND terms_accepted_at>0').bind(now,user.userId),
    // Never revive an expired/cancelled queue entry. Rejoining requires an explicit action.
    db.prepare('UPDATE matchmaking_queue SET expires_at=? WHERE user_id=? AND expires_at>?').bind(now+90000,user.userId,now),
  ]);
  return new Response(null,{status:204});
}
