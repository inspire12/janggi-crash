'use client';

import Link from 'next/link';
import JanggiBoardMarks from '@/components/janggi-board-marks';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowLeft, Flag, FlaskConical, MessageCircle, Radio, Send, Shield, Undo2, UserX } from 'lucide-react';
import { applyMove, isInCheck, legalMoves, type Piece, pieceLabel, type Point, type Side } from '@/lib/janggi';

type Player = { id?: string; side?: Side; displayName?: string; elo?: number; rank?: { name: string; key: string } };
type Payload = {
  match: { id: string; status: 'active' | 'finished'; turn: Side; board: Piece[]; version: number; winnerSide: Side | null; resultReason: string | null; choTimeMs: number; hanTimeMs: number; clockSyncedAt: number; canTakeback: boolean; takebackRequested: boolean; takebackRequestedByMe: boolean };
  you: Player & { side: Side };
  opponent: Player;
};

export default function OnlineBattle({ matchId }: { matchId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [illegalMove, setIllegalMove] = useState(false);
  const [trialBoard, setTrialBoard] = useState<Piece[] | null>(null);
  const [trialTurn, setTrialTurn] = useState<Side>('cho');

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
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!illegalMove) return;
    const timer = window.setTimeout(() => {
      setIllegalMove(false);
      setError('');
    }, 460);
    return () => window.clearTimeout(timer);
  }, [illegalMove]);

  const displayBoard = useMemo(() => trialBoard ?? data?.match.board ?? [], [trialBoard, data?.match]);
  const activeTurn = trialBoard ? trialTurn : data?.you.side;
  const selectedPiece = displayBoard.find((piece) => piece.id === selected);
  const targets = useMemo(
    () => selectedPiece ? legalMoves(selectedPiece, displayBoard) : [],
    [selectedPiece, displayBoard],
  );
  const isMyTurn = Boolean(trialBoard) || data?.match.status === 'active' && data.match.turn === data.you.side;
  const clock = (side: Side) => {
    if (!data) return 0;
    const base = side === 'cho' ? data.match.choTimeMs : data.match.hanTimeMs;
    const clientNow = now || data.match.clockSyncedAt;
    return Math.max(0, base - (data.match.status === 'active' && data.match.turn === side ? clientNow - data.match.clockSyncedAt : 0));
  };

  function choose(piece: Piece) {
    if (!data || !isMyTurn || sending) return;
    if (piece.side !== activeTurn) {
      const target = targets.find((point) => point.x === piece.x && point.y === piece.y);
      if (target) void move(target);
      else if (activeTurn && isInCheck(activeTurn, displayBoard)) rejectCheckedMove();
      return;
    }
    if (activeTurn && isInCheck(activeTurn, displayBoard) && legalMoves(piece, displayBoard).length === 0) {
      rejectCheckedMove();
      return;
    }
    setSelected(selected === piece.id ? null : piece.id);
  }
  function rejectCheckedMove() {
    setIllegalMove(false);
    requestAnimationFrame(() => setIllegalMove(true));
    setError('장군을 먼저 막아야 합니다. 표시된 자리로 이동하세요.');
  }
  function handleBoardClick(event: MouseEvent<HTMLDivElement>) {
    if (!data || event.target instanceof Element && event.target.closest('button')) return;
    if (activeTurn && isInCheck(activeTurn, displayBoard)) rejectCheckedMove();
  }
  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === 'Enter' || event.key === ' ') && activeTurn && isInCheck(activeTurn, displayBoard)) rejectCheckedMove();
  }

  async function move(to: Point) {
    if (!data || !selectedPiece || sending) return;
    if (trialBoard) {
      setTrialBoard(applyMove(trialBoard, selectedPiece.id, to));
      setTrialTurn(trialTurn === 'cho' ? 'han' : 'cho');
      setSelected(null);
      return;
    }
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
  async function matchAction(action: 'takeback-request' | 'takeback-accept' | 'takeback-reject') {
    setSending(true); setError('');
    try {
      const response = await fetch('/api/matches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId, action }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '요청을 처리하지 못했습니다.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.'); }
    finally { setSending(false); }
  }
  function toggleTrial() {
    if (!data || data.match.status !== 'active') return;
    if (trialBoard) { setTrialBoard(null); setSelected(null); return; }
    setTrialBoard(data.match.board.map((piece) => ({ ...piece })));
    setTrialTurn(data.match.turn);
    setSelected(null);
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
        <OnlinePlayer player={data.opponent} side={data.you.side === 'cho' ? 'han' : 'cho'} active={!isMyTurn && !result} label="상대" timeMs={clock(data.you.side === 'cho' ? 'han' : 'cho')} />
        <div className="arena online-arena">
          <div className="turn-indicator"><span className={trialBoard ? trialTurn : data.match.turn} />{trialBoard ? `${trialTurn === 'cho' ? '초' : '한'} 시험 수` : result ?? (isMyTurn ? '당신의 차례' : '상대의 차례')}{trialBoard && <b className="trial-badge">둬보기</b>}</div>
          {data.match.takebackRequested && <div className="takeback-request">{data.match.takebackRequestedByMe ? <span>상대의 무르기 응답을 기다리고 있습니다.</span> : <><span>상대가 직전 수를 무르자고 요청했습니다.</span><div><button onClick={() => void matchAction('takeback-accept')}>수락</button><button onClick={() => void matchAction('takeback-reject')}>거절</button></div></>}</div>}
          <div className="board-frame"><div className={`board ${illegalMove ? 'illegal-move' : ''}`} role="grid" aria-label="온라인 장기판" onClick={handleBoardClick} onKeyDown={handleBoardKeyDown} tabIndex={0}>
            <div className="river-mark">楚 河　　漢 界</div><div className="palace palace-top" /><div className="palace palace-bottom" /><JanggiBoardMarks />
            {targets.map((point) => <button key={`${point.x}-${point.y}`} aria-label={`${point.x + 1}열 ${point.y + 1}행으로 이동`} className="move-target" onClick={() => void move(point)} style={{ left: `${point.x * 12.5}%`, top: `${point.y * (100 / 9)}%` }} />)}
            {displayBoard.map((piece) => <button key={piece.id} onClick={() => choose(piece)} className={`piece ${piece.side} piece-${piece.kind} ${['pawn', 'guard'].includes(piece.kind) ? 'piece-small' : piece.kind === 'king' ? 'piece-king' : 'piece-medium'} ${selected === piece.id ? 'selected' : ''}`} style={{ left: `${piece.x * 12.5}%`, top: `${piece.y * (100 / 9)}%` }}><span>{pieceLabel(piece)}</span></button>)}
            {result && <output className={`mate-banner ${data.match.winnerSide}`}><span>{data.match.resultReason === 'resign' ? 'RESIGN' : 'CHECKMATE'}</span><strong>{result}</strong><b>{result === '승리' ? '전적 반영 완료' : '다음 대국을 준비하세요'}</b></output>}
          </div></div>
          <div className={`status-strip ${illegalMove ? 'illegal-status' : ''}`} aria-live="polite"><span className="status-dot" /><p>{error || (trialBoard ? '둬보기 중 · 실제 대국에는 반영되지 않습니다.' : result ? `대국 종료 · ${result}` : isMyTurn ? '기물을 선택해 수를 두세요.' : '상대의 수를 기다리고 있습니다.')}</p></div>
          {data.match.status === 'active' && <div className="battle-tools"><button disabled={sending || !data.match.canTakeback || data.match.takebackRequested || Boolean(trialBoard)} onClick={() => void matchAction('takeback-request')}><Undo2 /> 무르기</button><button className={trialBoard ? 'active' : ''} disabled={sending || data.match.takebackRequested} onClick={toggleTrial}><FlaskConical /> {trialBoard ? '둬보기 종료' : '둬보기'}</button><button className="danger" disabled={sending || Boolean(trialBoard)} onClick={() => void resign()}><Flag /> 기권</button></div>}
        </div>
        <OnlinePlayer player={data.you} side={data.you.side} active={Boolean(isMyTurn)} label="나" timeMs={clock(data.you.side)} />
      </section>
      <BattleChat matchId={matchId} youId={data.you.id ?? ''} opponentId={data.opponent.id ?? ''} />
    </main>
  );
}

function OnlinePlayer({ player, side, active, label, timeMs }: { player: Player; side: Side; active: boolean; label: string; timeMs: number }) {
  return <aside className={`player-card ${side}-card online-player ${active ? 'player-active' : ''}`}>
    <span className="side-label">{label} · {side === 'cho' ? '楚' : '漢'}</span>
    <div className="online-avatar"><Shield size={24} /></div>
    <h2>{player.displayName ?? '지휘관'}</h2>
    <div className="online-rating"><strong>{player.elo ?? 1200}</strong> ELO</div>
    <div className={`battle-clock ${timeMs < 60000 ? 'clock-danger' : ''}`}>{formatClock(timeMs)}</div>
    <p>{player.rank?.name ?? '18급'}</p>
  </aside>;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

type ChatMessage = { id: number; sender_user_id: string; body: string; created_at: number };
function BattleChat({ matchId, youId, opponentId }: { matchId: string; youId: string; opponentId: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('closed');
  const [requestedByMe, setRequestedByMe] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const response = await fetch(`/api/chat?matchId=${encodeURIComponent(matchId)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as { status: string; requestedByMe: boolean; messages: ChatMessage[] };
    setStatus(data.status); setRequestedByMe(data.requestedByMe); setMessages(data.messages);
  }, [matchId]);
  useEffect(() => {
    if (!open) return;
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 1500);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [open, load]);
  async function act(action: string, body?: object) {
    await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId, action, ...body }) });
    await load();
  }
  async function send(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); if (!message.trim()) return;
    await act('send', { message }); setMessage('');
  }
  async function block() {
    if (!opponentId || !window.confirm('상대를 악당 목록에 등록하고 채팅을 차단할까요?')) return;
    await fetch('/api/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'block', userId: opponentId }) });
    setOpen(false);
  }
  return <div className={`battle-chat ${open ? 'chat-open' : ''}`}>
    <button className="chat-toggle" onClick={() => setOpen(!open)} aria-label="채팅"><MessageCircle /><span>채팅</span></button>
    {open && <section className="chat-panel"><header><strong>대국 채팅</strong><button onClick={() => void block()}><UserX /> 악당등록</button></header>
      {status === 'closed' && <div className="chat-consent"><p>기본 채팅은 꺼져 있습니다. 상대에게 대화를 요청하시겠습니까?</p><button onClick={() => void act('request')}>채팅 요청</button></div>}
      {status === 'pending' && requestedByMe && <div className="chat-consent"><p>상대의 수락을 기다리고 있습니다.</p></div>}
      {status === 'pending' && !requestedByMe && <div className="chat-consent"><p>상대가 채팅을 요청했습니다.</p><div><button onClick={() => void act('accept')}>수락</button><button onClick={() => void act('reject')}>거절</button></div></div>}
      {status === 'rejected' && <div className="chat-consent"><p>채팅 요청이 거절되었습니다.</p></div>}
      {status === 'accepted' && <><div className="chat-messages">{messages.length ? messages.map((item) => <p className={item.sender_user_id === youId ? 'mine' : ''} key={item.id}>{item.body}</p>) : <span>채팅이 열렸습니다.</span>}</div><form onSubmit={send}><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={200} aria-label="채팅 메시지" placeholder="메시지 입력" /><button aria-label="전송"><Send /></button></form></>}
    </section>}
  </div>;
}
