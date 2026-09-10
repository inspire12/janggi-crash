import LoginForm from './login-form';
import TestLogin from './test-login';
import { localTestingEnabled } from '@/lib/local-testing';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (localTestingEnabled()) return <main className="join-shell"><section className="join-card"><h1>1:1 대국 테스트</h1><TestLogin /></section></main>;
  return <main className="join-shell"><section className="join-card">
    <h1>장기: 격돌 로그인</h1>
    <p className="join-intro">카카오 계정으로 간편하게 시작하세요.</p>
    <LoginForm failed={Boolean(error)} />
  </section></main>;
}
