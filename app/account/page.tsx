import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import { rankForScore } from '@/lib/rating';
import AccountSettings from './settings';
import RewardPanel from './rewards';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireAppUser('/account');
  const profile = await getPlayer(user.userId);
  if (!profile?.terms_accepted_at) redirect('/join');
  const games = profile.wins + profile.losses + profile.draws;
  return <main className="account-page">
    <header className="account-page-header"><Link href="/lobby">← 대국실</Link><h1>내 정보</h1><Link href="/settings">설정 →</Link></header>
    <div className="account-page-content">
      <section id="record" className="account-record" aria-labelledby="record-title">
        <div className="account-identity"><h2 id="record-title">{profile.display_name}</h2><span>{rankForScore(profile.rank_score).name}</span></div>
        <p>승강급 점수 {rankForScore(profile.rank_score).points} / 100 · {rankForScore(profile.rank_score).next === null ? '최고 등급' : `승급까지 ${rankForScore(profile.rank_score).next}점`}</p>
        <p className="account-elo"><strong>{profile.elo.toLocaleString()}</strong> ELO</p>
        <dl className="account-stat-grid"><div><dt>대국</dt><dd>{games}</dd></div><div><dt>승</dt><dd>{profile.wins}</dd></div><div><dt>패</dt><dd>{profile.losses}</dd></div><div><dt>무</dt><dd>{profile.draws}</dd></div><div><dt>승률</dt><dd>{games ? Math.round(profile.wins / games * 100) : 0}%</dd></div></dl>
        <Link className="account-record-link" href="/review">내 기보 보기 <span aria-hidden="true">→</span></Link>
      </section>
      <div className="account-sections"><RewardPanel /><AccountSettings initialName={profile.display_name} initialTakeback={profile.allow_takeback_requests === 1} /></div>
    </div>
  </main>;
}
