import Link from 'next/link';
import { resultLabel } from '@/lib/result-label';
import { requireAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { getPlayer } from '@/db/players';
import LobbyClient from '@/app/lobby/lobby-client';
export const dynamic = 'force-dynamic';
export default async function ReviewPage() {
  const user=await requireAppUser('/review');
  const profile=await getPlayer(user.userId);
  const rows=await getDatabase().prepare(`SELECT m.id, m.created_at, m.result_reason, m.winner_user_id,
    c.display_name AS cho, h.display_name AS han FROM matches m
    JOIN players c ON c.id=m.cho_user_id JOIN players h ON h.id=m.han_user_id
    WHERE (m.cho_user_id=? OR m.han_user_id=?) AND m.status='finished'
    ORDER BY m.created_at DESC, m.id DESC LIMIT 100`).bind(user.userId,user.userId).all<{id:string;created_at:number;result_reason:string;winner_user_id:string|null;cho:string;han:string}>();
  return <LobbyClient authenticated registered={Boolean(profile?.terms_accepted_at)} initialTab="review" reviewContent={<section className="lobby-records"><div className="lobby-greeting"><h1>내 기보</h1><p>최근 완료한 대국 100개</p></div>
    {rows.results.length ? <ul className="record-list">{rows.results.map(row=><li key={row.id}><Link href={`/review/${row.id}`}><strong>{row.cho} · {row.han}</strong><span>{resultLabel(row.result_reason,row.winner_user_id ? row.winner_user_id===user.userId : null)} · {new Date(Number(row.created_at)).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</span></Link></li>)}</ul>:<p>아직 완료한 대국이 없습니다.</p>}
  </section>} />;
}
