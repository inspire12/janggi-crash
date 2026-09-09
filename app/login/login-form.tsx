'use client';
import { useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, token: sent ? token : undefined }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || '로그인에 실패했습니다.');
      if (sent) window.location.assign('/join');
      else setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.'); }
    finally { setBusy(false); }
  }
  return <form className="join-form" onSubmit={submit}>
    <label>이메일<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={sent} /></label>
    {sent && <label>인증번호<input inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e => setToken(e.target.value)} pattern="[0-9]{6,10}" required /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="match-button" disabled={busy}>{busy ? '처리 중…' : sent ? '로그인' : '인증번호 받기'}</button>
    {sent && <button type="button" onClick={() => { setSent(false); setToken(''); }}>이메일 변경 / 다시 보내기</button>}
  </form>;
}
