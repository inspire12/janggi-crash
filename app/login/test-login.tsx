'use client';
import { useState } from 'react';

export default function TestLogin() {
  const [slot, setSlot] = useState('a');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="join-form" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot, password }) });
      if (!response.ok) throw new Error('테스트 계정과 암호를 확인하세요.');
      window.location.assign('/lobby');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '연결 실패'); setBusy(false); }
  }}>
    <p>개발 전용 · 운영 계정과 전적에 영향을 주지 않습니다.</p>
    <fieldset disabled={busy}><legend>테스트 계정</legend>
      <label><input type="radio" name="slot" checked={slot === 'a'} onChange={() => setSlot('a')} />테스터 A</label>
      <label><input type="radio" name="slot" checked={slot === 'b'} onChange={() => setSlot('b')} />테스터 B</label>
    </fieldset>
    <label>테스트 암호<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
    {error && <p role="alert">{error}</p>}
    <button className="match-button" disabled={busy}>{busy ? '연결 중…' : '테스트 로비 입장'}</button>
  </form>;
}
