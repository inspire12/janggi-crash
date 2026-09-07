import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { getPlayer } from '@/db/players';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import JoinForm from './join-form';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const user = await getChatGPTUser();
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
            <p>안전한 계정 확인을 위해 ChatGPT 로그인을 사용합니다. 별도 비밀번호는 저장하지 않습니다.</p>
            <a className="match-button" href={chatGPTSignInPath('/join')} target="_top">ChatGPT로 계정 만들기</a>
          </div>
        )}
      </section>
    </main>
  );
}
