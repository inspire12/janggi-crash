'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function JoinForm({ email, initialName }: { email: string; initialName: string }) {
  const [displayName, setDisplayName] = useState(initialName.slice(0, 16));
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, termsAccepted: accepted }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '계정을 만들지 못했습니다.');
      window.location.assign('/lobby');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '계정을 만들지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <form className="join-form" onSubmit={submit}>
      <label><span>연결된 계정</span><input value={email || '카카오 계정'} disabled /></label>
      <label><span>게임 닉네임</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={16} autoComplete="off" required /></label>
      <label className="terms-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>대국 전적과 ELO 산정을 위한 계정 정보 저장에 동의합니다.</span></label>
      {error && <p className="form-error">{error}</p>}
      <button className="match-button" disabled={busy || !accepted} type="submit"><ShieldCheck size={20} /> {busy ? '등록 중…' : '지휘관 등록 완료'}</button>
    </form>
  );
}
