'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Search, UserPlus, Users, X } from 'lucide-react';
import ChallengePanel from './challenge-panel';
import FriendGroups, {type GroupFriend} from './friend-groups';

type Friend = GroupFriend;
type SearchResult = { id: string; display_name: string; elo: number; relationship: 'friend' | 'sent' | 'received' | null };
type FriendData = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };

export default function FriendPanel() {
  const [data, setData] = useState<FriendData>({ friends: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/friends', { cache: 'no-store' });
    if (response.ok) setData(await response.json() as FriendData);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load().catch(() => {}), 15000);
    return () => {window.clearTimeout(timer);window.clearInterval(poll);};
  }, [load]);

  async function search(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setMessage('');
    const response = await fetch(`/api/friends?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
    const result = await response.json() as { results?: SearchResult[]; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(result.error ?? '친구를 찾지 못했습니다.');
    setResults(result.results ?? []);
    if (!result.results?.length) setMessage('일치하는 장기: 격돌 사용자가 없습니다.');
  }

  async function act(action: 'request' | 'accept' | 'reject' | 'cancel' | 'remove', userId: string) {
    setBusy(true); setMessage('');
    const response = await fetch('/api/friends', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, userId }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(result.error ?? '요청을 처리하지 못했습니다.');
    setResults((current) => current.map((player) => player.id === userId
      ? { ...player, relationship: action === 'request' ? 'sent' : player.relationship }
      : player));
    await load();
  }

  const relationshipLabel = (relationship: SearchResult['relationship']) => {
    if (relationship === 'friend') return '친구';
    if (relationship === 'sent') return '요청 보냄';
    if (relationship === 'received') return '받은 요청';
    return null;
  };

  return <section className="friends-panel">
    <div className="friends-panel-head">
      <div><span><Users size={13} /> MY FRIENDS</span><h2>장기 친구</h2><p>닉네임으로 찾아 친구가 되면 친선 대국을 바로 신청할 수 있어요.</p></div>
      <button className="kakao-friends-button" disabled title="카카오 개발자 권한 승인 후 연결할 수 있습니다."><b>talk</b> 카카오톡 친구 연결 <small>준비 중</small></button>
    </div>

    <form className="friend-search" onSubmit={search}>
      <Search aria-hidden="true" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={16} placeholder="친구 닉네임 검색" aria-label="친구 닉네임" />
      <button disabled={busy || !query.trim()}>{busy ? '찾는 중' : '검색'}</button>
    </form>
    {message && <p className="friend-message">{message}</p>}
    {results.length > 0 && <ul className="friend-results">{results.map((player) => {
      const label = relationshipLabel(player.relationship);
      return <li key={player.id}><div><strong>{player.display_name}</strong><span>{player.elo} ELO</span></div>{label ? <em>{label}</em> : <button disabled={busy} onClick={() => void act('request', player.id)}><UserPlus /> 친구 요청</button>}</li>;
    })}</ul>}

    {data.incoming.length > 0 && <div className="friend-group"><h3>받은 요청 <b>{data.incoming.length}</b></h3><ul>{data.incoming.map((player) => <li key={player.id}><div><strong>{player.displayName}</strong><span>{player.elo} ELO</span></div><div className="friend-actions"><button aria-label={`${player.displayName} 친구 요청 수락`} disabled={busy} onClick={() => void act('accept', player.id)}><Check /></button><button aria-label={`${player.displayName} 친구 요청 거절`} disabled={busy} onClick={() => void act('reject', player.id)}><X /></button></div></li>)}</ul></div>}

    <FriendGroups friends={data.friends} onChange={load} onRemove={id=>void act('remove',id)} />
    <ChallengePanel friends={data.friends} />
  </section>;
}
