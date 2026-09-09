import LoginForm from './login-form';

export default function LoginPage() {
  return <main className="join-shell"><section className="join-card">
    <h1>장기: 격돌 로그인</h1>
    <p className="join-intro">이메일로 받은 인증번호로 가입하고 로그인하세요. 비밀번호는 필요하지 않습니다.</p>
    <LoginForm />
  </section></main>;
}
