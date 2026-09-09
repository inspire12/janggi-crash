'use client';
import { useState } from 'react';

export default function LoginForm({ failed = false }: { failed?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed ? '카카오 로그인을 완료하지 못했습니다. 다시 시도해 주세요.' : '');
  async function login() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'POST' });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? '로그인을 시작하지 못했습니다.');
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그인 연결에 실패했습니다.');
      setBusy(false);
    }
  }
  return <div className="join-form">
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="match-button" style={{ background: '#FEE500', color: '#191919' }} disabled={busy} onClick={() => void login()}>
      {busy ? '카카오 연결 중…' : '카카오로 시작하기'}
    </button>
  </div>;
}
