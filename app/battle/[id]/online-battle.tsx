'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Radio, Shield } from 'lucide-react';
import { legalMoves, type Piece, type Point, type Side } from '@/lib/janggi';

type Player = { side?: Side; displayName?: string; elo?: number; rank?: { name: string; key: string } };
type Payload = {
  match: { id: string; status: 'active' | 'finished'; turn: Side; board: Piece[]; version: number; winnerSide: Side | null; resultReason: string | null };
  you: Player & { side: Side };
  opponent: Player;
};

export default function OnlineBattle({ matchId }: { matchId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/matches?id=${encodeURIComponent(matchId)}`, { cache: 'no-store' });
    const next = (await response.json()) as Payload & { error?: string };
    if (!response.ok) throw new Error(next.error ?? '대국을 불러오지 못했습니다.');
    setData(next);
  }, [matchId]);

  useEffect(() => {
    const first = window.setTimeout(
      () => void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : '연결에 실패했습니다.')),
      0,
    );
    const timer = window.setInterval(() => void refresh().catch(() => {}), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const selectedPiece = data?.match.board.find((piece) => piece.id === selected);
  const targets = useMemo(
    () => selectedPiece && data ? legalMoves(selectedPiece, data.match.board) : [],
    [selectedPiece, data],
  );
  const isMyTurn = data?.match.status === 'active' && data.match.turn === data.you.side;

  function choose(piece: Piece) {
    if (!data || !isMyTurn || sending) return;
    if (piece.side !== data.you.side) {
      const target = targets.find((point) => point.x === piece.x && point.y === piece.y);
      if (target) void move(target);
      return;
    }
    setSelected(selected === piece.id ? null : piece.id);
  }

  async function move(to: Point) {
    if (!data || !selectedPiece || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId, action: 'move', pieceId: selectedPiece.id, to, version: data.match.version }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '수를 반영하지 못했습니다.');
      setSelected(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '수를 반영하지 못했습니다.');
      await refresh().catch(() => {});
    } finally {
      setSending(false);
    }
  }

  async function resign() {
    if (!data || data.match.status !== 'active' || !window.confirm('정말 기권하시겠습니까?')) return;
    await fetch('/api/matches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId, action: 'resign' }),
    });
    await refresh();
  }

  if (!data) return <main className="battle-loading">{error || '전장을 불러오는 중…'}</main>;
  const result = data.match.status === 'finished'
    ? data.match.winnerSide === data.you.side ? '승리' : '패배'
    : null;

  return (
    <main className="game-shell online-shell">
      <header className="topbar">
        <Link className="brand" href="/lobby"><span className="brand-mark"><i>將</i></span><span>장기: 격돌</span><em>ONLINE</em></Link>
        <div className="live-state"><Radio size={14} /> 실시간 대국</div>
        <Link className="text-btn" href="/lobby"><ArrowLeft size={15} /> 로비</Link>
      </header>
      <section className="online-match-layout">
        <OnlinePlayer player={data.opponent} side={data.you.side === 'cho' ? 'han' : 'cho'} active={!isMyTurn && !result} label="상대" />
        <div className="arena online-arena">
          <div className="turn-indicator"><span className={data.match.turn} />{result ?? (isMyTurn ? '당신의 차례' : '상대의 차례')}</div>
          <div className="board-frame"><div className="board" role="grid" aria-label="온라인 장기판">
            <div className="river-mark">楚 河　　漢 界</div><div className="palace palace-top" /><div className="palace palace-bottom" />
            {targets.map((point) => <button key={`${point.x}-${point.y}`} aria-label={`${point.x + 1}열 ${point.y + 1}행으로 이동`} className="move-target" onClick={() => void move(point)} style={{ left: `${point.x * 12.5}%`, top: `${point.y * (100 / 9)}%` }} />)}
            {data.match.board.map((piece) => <button key={piece.id} onClick={() => choose(piece)} className={`piece ${piece.side} ${['pawn', 'guard'].includes(piece.kind) ? 'piece-small' : piece.kind === 'king' ? 'piece-king' : 'piece-medium'} ${selected === piece.id ? 'selected' : ''}`} style={{ left: `${piece.x * 12.5}%`, top: `${piece.y * (100 / 9)}%` }}><span>{piece.label}</span></button>)}
            {result && <output className={`mate-banner ${data.match.winnerSide}`}><span>{data.match.resultReason === 'resign' ? 'RESIGN' : 'CHECKMATE'}</span><strong>{result}</strong><b>{result === '승리' ? '전적 반영 완료' : '다음 대국을 준비하세요'}</b></output>}
          </div></div>
          <div className="status-strip"><span className="status-dot" /><p>{error || (result ? `대국 종료 · ${result}` : isMyTurn ? '기물을 선택해 수를 두세요.' : '상대의 수를 기다리고 있습니다.')}</p>{data.match.status === 'active' && <button className="resign-button" onClick={() => void resign()}>기권</button>}</div>
        </div>
        <OnlinePlayer player={data.you} side={data.you.side} active={Boolean(isMyTurn)} label="나" />
      </section>
    </main>
  );
}

function OnlinePlayer({ player, side, active, label }: { player: Player; side: Side; active: boolean; label: string }) {
  return <aside className={`player-card ${side}-card online-player ${active ? 'player-active' : ''}`}>
    <span className="side-label">{label} · {side === 'cho' ? '楚' : '漢'}</span>
    <div className="online-avatar"><Shield size={24} /></div>
    <h2>{player.displayName ?? '지휘관'}</h2>
    <div className="online-rating"><strong>{player.elo ?? 1200}</strong> ELO</div>
    <p>{player.rank?.name ?? '입문'}</p>
  </aside>;
}
