import { signInPath, getAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import JoinForm from './join-form';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const user = await getAppUser();
  if (user && (await getPlayer(user.userId))?.terms_accepted_at) redirect('/lobby');

  return (
    <main className="join-shell">
      <section className="join-card">
        <Link className="brand join-brand" href="/">
          <span className="brand-mark"><i>將</i></span><span>장기: 격돌</span>
        </Link>
        <span className="eyebrow">COMMANDER REGISTRATION</span>
        <h1>지휘관 등록</h1>
        <p className="join-intro">하나의 계정으로 전적과 기력, ELO 계급을 이어가세요.</p>
        {user ? (
          <JoinForm email={user.email} initialName={user.displayName} />
        ) : (
          <div className="join-auth">
            <p>카카오 로그인 후 게임 닉네임을 정하면 바로 시작할 수 있어요.</p>
            <a className="match-button" href={signInPath('/join')}>카카오로 시작하기</a>
          </div>
        )}
      </section>
    </main>
  );
}
