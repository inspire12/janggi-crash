'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

export default function AccountSettings({ initialName, initialTakeback, mode = 'profile' }: { initialName: string; initialTakeback: boolean; mode?: 'profile' | 'preferences' }) {
  const [name, setName] = useState(initialName);
  const [takeback, setTakeback] = useState(initialTakeback);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(body: { displayName: string } | { allowTakebackRequests: boolean }) {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; displayName?: string; allowTakebackRequests?: boolean };
      if (!response.ok) throw new Error(result.error ?? '저장하지 못했습니다. 다시 시도해 주세요.');
      if (result.displayName) setName(result.displayName);
      if (typeof result.allowTakebackRequests === 'boolean') setTakeback(result.allowTakebackRequests);
      setMessage('저장했습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      window.location.assign('/lobby');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요.'); setBusy(false); }
  }

  return <div id="settings" className="account-settings">
    {mode === 'profile' && <form onSubmit={(event) => { event.preventDefault(); void save({ displayName: name }); }}>
      <h2>프로필</h2>
      <label htmlFor="account-name">닉네임</label>
      <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={16} required disabled={busy} autoComplete="off" />
      <small>한글, 영문, 숫자, 밑줄, 공백 · 2~16자</small>
      <button className="match-button" disabled={busy}>닉네임 저장</button>
    </form>}
    {mode === 'preferences' && <section><h2>온라인 대국</h2><div className="account-preference"><span>무르기 요청 받기</span><Switch checked={takeback} disabled={busy} onCheckedChange={(value) => void save({ allowTakebackRequests: value })} aria-label="무르기 요청 받기" /></div><p>상대의 무르기 요청을 받을지 선택합니다. 끄면 대기 중인 상대 요청도 취소됩니다.</p><small>변경 즉시 계정에 저장되며 다른 기기에서도 적용됩니다.</small></section>}
    <output aria-live="polite">{message}</output>{error && <p role="alert" className="form-error">{error}</p>}
    {mode === 'preferences' && <section><h2>계정</h2><button className="text-btn" onClick={() => void logout()} disabled={busy}>로그아웃</button></section>}
  </div>;
}
