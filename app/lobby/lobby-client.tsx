'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Radio, Shield, Swords, Trophy } from 'lucide-react';

type Profile = {
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  games: number;
  winRate: number;
  rank: { name: string; key: string };
};

export default function LobbyClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshQueue = useCallback(async () => {
    const response = await fetch('/api/matchmaking', { cache: 'no-store' });
    if (!response.ok) throw new Error('대기열 상태를 불러오지 못했습니다.');
    const data = (await response.json()) as { queued: boolean; matchId: string | null };
    if (data.matchId) window.location.assign(`/battle/${data.matchId}`);
    setQueued(data.queued);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([
        fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()),
        refreshQueue(),
      ])
        .then(([me]) => setProfile(me as Profile))
        .catch((cause) => setError(cause instanceof Error ? cause.message : '연결에 실패했습니다.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshQueue]);

  useEffect(() => {
    if (!queued) return;
    const timer = window.setInterval(() => void refreshQueue().catch(() => {}), 1500);
    return () => window.clearInterval(timer);
  }, [queued, refreshQueue]);

  async function changeQueue(action: 'join' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { queued?: boolean; matchId?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? '요청에 실패했습니다.');
      if (data.matchId) return window.location.assign(`/battle/${data.matchId}`);
      setQueued(Boolean(data.queued));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lobby-shell">
      <header className="topbar lobby-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark"><i>將</i></span>
          <span>장기: 격돌</span>
          <em>ONLINE</em>
        </Link>
        <Link className="text-btn" href="/"><ArrowLeft size={15} /> 연습판</Link>
      </header>
      <section className="lobby-content">
        <div className="lobby-copy">
          <span className="eyebrow"><Radio size={14} /> RANKED MATCH</span>
          <h1>전장의 상대를<br />찾으십시오.</h1>
          <p>기력이 가장 가까운 상대와 자동으로 매칭됩니다. 승패에 따라 ELO와 계급이 즉시 반영됩니다.</p>
        </div>
        <section className="profile-panel">
          {profile ? (
            <>
              <div className="profile-heading">
                <div className={`rank-emblem ${profile.rank.key}`}><Shield size={30} /></div>
                <div><span>지휘관</span><h2>{profile.displayName}</h2></div>
                <div className="elo"><strong>{profile.elo}</strong><span>ELO</span></div>
              </div>
              <div className="rank-name"><Trophy size={16} /> {profile.rank.name}</div>
              <div className="record-grid">
                <div><strong>{profile.games}</strong><span>대국</span></div>
                <div><strong>{profile.wins}</strong><span>승</span></div>
                <div><strong>{profile.losses}</strong><span>패</span></div>
                <div><strong>{profile.winRate}%</strong><span>승률</span></div>
              </div>
              <button
                className={`match-button ${queued ? 'searching' : ''}`}
                disabled={busy}
                onClick={() => void changeQueue(queued ? 'cancel' : 'join')}
              >
                <Swords size={21} />
                {busy ? '연결 중…' : queued ? '상대 찾는 중 · 취소' : '랭크 대전 찾기'}
              </button>
              {queued && <p className="queue-message"><i /> 기력이 비슷한 지휘관을 탐색하고 있습니다.</p>}
              {error && <p className="form-error">{error}</p>}
            </>
          ) : <div className="profile-loading">전적을 불러오는 중…</div>}
        </section>
      </section>
    </main>
  );
}
