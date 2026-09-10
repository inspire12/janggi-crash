import { getAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import { getDatabase } from '@/db';

async function rewards(claim: boolean) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!(await getPlayer(user.userId))?.terms_accepted_at) return Response.json({ error: '계정 설정을 완료해 주세요.' }, { status: 403 });
  return getDatabase().transaction(async db => {
    await db.prepare('INSERT INTO player_rewards(player_id) VALUES (?) ON CONFLICT DO NOTHING').bind(user.userId).run();
    const state = await db.prepare(`SELECT points, streak, last_day::text,
      (now() AT TIME ZONE 'Asia/Seoul')::date::text AS today,
      last_day = (now() AT TIME ZONE 'Asia/Seoul')::date - 1 AS yesterday
      FROM player_rewards WHERE player_id = ? FOR UPDATE`).bind(user.userId).first<{points:number;streak:number;last_day:string|null;today:string;yesterday:boolean}>();
    if (!state) throw new Error('Reward account missing');
    if (state.last_day !== state.today && !state.yesterday) state.streak = 0;
    let awarded = 0;
    if (claim && state.last_day !== state.today) {
      state.streak = state.yesterday ? state.streak + 1 : 1;
      awarded = 100 + (state.streak % 7 === 0 ? 300 : 0);
      await db.prepare('INSERT INTO point_ledger(player_id,day,amount,reason) VALUES (?,?::date,?,?)').bind(user.userId,state.today,awarded,'attendance').run();
      await db.prepare('UPDATE player_rewards SET points = points + ?, streak = ?, last_day = ?::date WHERE player_id = ?').bind(awarded,state.streak,state.today,user.userId).run();
      state.points += awarded; state.last_day = state.today;
    }
    return Response.json({points:state.points,streak:state.streak,claimed:state.last_day === state.today,awarded}, {headers:{'Cache-Control':'private, no-store'}});
  });
}
export async function GET() { return rewards(false); }
export async function POST() { return rewards(true); }
