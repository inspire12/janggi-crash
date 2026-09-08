'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Flag, FlaskConical, RotateCcw, Sparkles, Swords, Undo2, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import JanggiBoardMarks from '@/components/janggi-board-marks';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  applyMove,
  createInitialPieces,
  formations,
  initialPieces,
  pieceLabel,
  isCheckmate,
  isInCheck,
  legalMoves,
  type Piece,
  type Side,
  type Kind,
  type Formation,
} from '@/lib/janggi';
const PIECE_SCORE: Record<Kind, number> = {
  king: 0,
  rook: 13,
  cannon: 7,
  horse: 5,
  elephant: 3,
  guard: 3,
  pawn: 2,
};
const impactTier = (kind: Kind) =>
  kind === 'king'
    ? 6
    : kind === 'rook'
      ? 5
      : kind === 'cannon'
        ? 4
        : kind === 'horse'
          ? 3
          : kind === 'elephant' || kind === 'guard'
            ? 2
            : 1;
declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: unknown,
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}
export default function Home() {
  const [pieces, setPieces] = useState(initialPieces),
    [selected, setSelected] = useState<string | null>(null),
    [turn, setTurn] = useState<Side>('cho'),
    [winner, setWinner] = useState<Side | null>(null),
    [motion, setMotion] = useState<{ id: string; capture: boolean } | null>(
      null,
    ),
    [cinema, setCinema] = useState(true),
    [sound, setSound] = useState(true),
    [impact, setImpact] = useState<{
      x: number;
      y: number;
      label: string;
      tier: number;
    } | null>(null),
    [status, setStatus] = useState('초의 기물을 선택하세요.');
  const [choFormation, setChoFormation] = useState<Formation>('horse-elephant-elephant-horse');
  const [hanFormation, setHanFormation] = useState<Formation>('elephant-horse-horse-elephant');
  const [setupOpen, setSetupOpen] = useState(true);
  const [illegalMove, setIllegalMove] = useState(false);
  const [history, setHistory] = useState<Array<{ pieces: Piece[]; turn: Side }>>([]);
  const [trialSnapshot, setTrialSnapshot] = useState<{ pieces: Piece[]; turn: Side; winner: Side | null } | null>(null);
  const motionSequence = useRef(0);
  const selectedPiece = pieces.find((p) => p.id === selected);
  const targets = useMemo(
    () => (selectedPiece ? legalMoves(selectedPiece, pieces) : []),
    [selectedPiece, pieces],
  );
  useEffect(() => {
    if (!impact) return;
    const t = window.setTimeout(() => setImpact(null), 900);
    return () => window.clearTimeout(t);
  }, [impact]);
  useEffect(() => {
    if (!illegalMove) return;
    const timer = window.setTimeout(() => setIllegalMove(false), 460);
    return () => window.clearTimeout(timer);
  }, [illegalMove]);
  function rejectCheckedMove() {
    setIllegalMove(false);
    requestAnimationFrame(() => setIllegalMove(true));
    setStatus('장군을 먼저 막아야 합니다. 표시된 자리로 이동하세요.');
  }
  function handleBoardClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (isInCheck(turn, pieces)) rejectCheckedMove();
  }
  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === 'Enter' || event.key === ' ') && isInCheck(turn, pieces)) rejectCheckedMove();
  }
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'reset_janggi_match',
          title: '장기 대국 다시 두기',
          description: '현재 연출 프로토타입을 처음 상태로 되돌립니다.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute() {
            motionSequence.current += 1;
            setPieces(initialPieces);
            setSetupOpen(true);
            setSelected(null);
            setTurn('cho');
            setWinner(null);
            setImpact(null);
            setMotion(null);
            setStatus('초의 기물을 선택하세요.');
            return { status: 'reset', turn: 'cho' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function choose(p: Piece) {
    if (winner || motion) return;
    if (p.side !== turn) {
      if (selectedPiece && targets.some((to) => to.x === p.x && to.y === p.y)) {
        move(p.x, p.y);
      } else if (isInCheck(turn, pieces)) {
        rejectCheckedMove();
      }
      return;
    }
    if (selected === p.id) {
      setSelected(null);
      setStatus(`${turn === 'cho' ? '초' : '한'}의 기물을 선택하세요.`);
      return;
    }
    const moves = legalMoves(p, pieces);
    if (isInCheck(turn, pieces) && moves.length === 0) {
      rejectCheckedMove();
      return;
    }
    setSelected(p.id);
    setStatus(
      `${p.name} 선택 — 이동 가능한 자리 ${moves.length}곳`,
    );
  }
  function move(x: number, y: number) {
    if (
      winner ||
      motion ||
      !selectedPiece ||
      !targets.some((t) => t.x === x && t.y === y)
    )
      return;
    const victim = pieces.find(
      (p) => p.x === x && p.y === y && p.side !== selectedPiece.side,
    );
    const nextPieces = applyMove(pieces, selectedPiece.id, { x, y });
    if (!trialSnapshot) setHistory((current) => [...current, { pieces, turn }]);
    const nextTurn = turn === 'cho' ? 'han' : 'cho';
    const checkmate = isCheckmate(nextTurn, nextPieces);
    const movingId = selectedPiece.id;
    const sequence = ++motionSequence.current;
    const travelPieces = victim
      ? pieces.map((piece) =>
          piece.id === movingId ? { ...piece, x, y } : piece,
        )
      : nextPieces;
    setMotion({ id: movingId, capture: Boolean(victim) });
    setStatus(
      victim
        ? `${selectedPiece.name} 공격 — ${victim?.name}을 향해 돌진합니다.`
        : `${selectedPiece.name} 이동 중…`,
    );
    requestAnimationFrame(() => setPieces(travelPieces));
    window.setTimeout(
      () => {
        if (motionSequence.current !== sequence) return;
        setPieces(nextPieces);
        if (checkmate) {
          setWinner(turn);
          setImpact({ x, y, label: '외통!', tier: 6 });
          setStatus(`외통 — ${turn === 'cho' ? '초' : '한'}의 승리!`);
        } else if (victim) {
          const tier = impactTier(victim.kind);
          const score = PIECE_SCORE[victim.kind];
          setImpact({
            x,
            y,
            label:
              victim.kind === 'king'
                ? '승리!'
                : `+${score} ${tier >= 4 ? '대격파' : '격파'}`,
            tier,
          });
          setStatus(
            victim.kind === 'king'
              ? `${turn === 'cho' ? '초' : '한'}의 승리!`
              : `${selectedPiece.name}(으)로 ${victim.name}을 잡았습니다. +${score}점`,
          );
        } else if (isInCheck(nextTurn, nextPieces)) {
          setImpact({ x, y, label: '장군!', tier: 4 });
          setStatus(
            `장군! ${nextTurn === 'cho' ? '초' : '한'}의 궁이 공격받고 있습니다.`,
          );
        } else setStatus(`${selectedPiece.name} 이동 완료.`);
        setSelected(null);
        setTurn(nextTurn);
        setMotion(null);
      },
      victim ? 460 : 300,
    );
  }
  function reset() {
    motionSequence.current += 1;
    setPieces(createInitialPieces(choFormation, hanFormation));
    setSelected(null);
    setTurn('cho');
    setWinner(null);
    setImpact(null);
    setMotion(null);
    setStatus('초의 기물을 선택하세요.');
    setSetupOpen(true);
    setHistory([]);
    setTrialSnapshot(null);
  }
  function startMatch() {
    motionSequence.current += 1;
    setPieces(createInitialPieces(choFormation, hanFormation));
    setSelected(null);
    setTurn('cho');
    setWinner(null);
    setImpact(null);
    setMotion(null);
    setStatus('초의 기물을 선택하세요.');
    setSetupOpen(false);
    setHistory([]);
    setTrialSnapshot(null);
  }
  function takeback() {
    if (motion || trialSnapshot || history.length === 0) return;
    const previous = history[history.length - 1];
    motionSequence.current += 1;
    setPieces(previous.pieces);
    setTurn(previous.turn);
    setWinner(null);
    setSelected(null);
    setImpact(null);
    setMotion(null);
    setHistory((current) => current.slice(0, -1));
    setStatus('직전 수를 물렀습니다.');
  }
  function resign() {
    if (winner || motion || !window.confirm(`${turn === 'cho' ? '초' : '한'} 진영이 기권할까요?`)) return;
    setWinner(turn === 'cho' ? 'han' : 'cho');
    setSelected(null);
    setStatus(`${turn === 'cho' ? '초' : '한'}의 기권으로 ${turn === 'cho' ? '한' : '초'}가 승리했습니다.`);
  }
  function toggleTrial() {
    if (motion || winner) return;
    if (trialSnapshot) {
      setPieces(trialSnapshot.pieces);
      setTurn(trialSnapshot.turn);
      setWinner(trialSnapshot.winner);
      setTrialSnapshot(null);
      setSelected(null);
      setImpact(null);
      setStatus('실제 대국으로 돌아왔습니다.');
      return;
    }
    setTrialSnapshot({ pieces, turn, winner });
    setSelected(null);
    setStatus('둬보기 중 · 시험한 수는 실제 대국에 반영되지 않습니다.');
  }
  return (
    <main
      className={`game-shell ${impact && cinema ? `screen-impact impact-screen-${impact.tier}` : ''}`}
    >
      <FormationDialog
        open={setupOpen}
        cho={choFormation}
        han={hanFormation}
        onCho={setChoFormation}
        onHan={setHanFormation}
        onStart={startMatch}
      />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <i>將</i>
          </span>
          <span>장기: 격돌</span>
          <em>PROTOTYPE 01</em>
        </div>
        <div className="header-actions">
          <Link className="text-btn online-link" href="/lobby">
            <Swords size={15} /> 온라인 대전
          </Link>
          <button
            className={`icon-btn ${cinema ? 'active' : ''}`}
            onClick={() => setCinema(!cinema)}
            aria-label="연출 효과 전환"
          >
            <Sparkles size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setSound(!sound)}
            aria-label="소리 전환"
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="text-btn" onClick={reset}>
            <RotateCcw size={15} /> 다시 두기
          </button>
          <button className="text-btn" disabled={history.length === 0 || Boolean(trialSnapshot)} onClick={takeback}><Undo2 size={15} /> 무르기</button>
          <button className={`text-btn ${trialSnapshot ? 'active' : ''}`} disabled={Boolean(winner)} onClick={toggleTrial}><FlaskConical size={15} /> {trialSnapshot ? '둬보기 종료' : '둬보기'}</button>
          <button className="text-btn danger" disabled={Boolean(winner)} onClick={resign}><Flag size={15} /> 기권</button>
        </div>
      </header>
      <section className="match-layout">
        <Player side="han" active={turn === 'han'} />
        <div className="arena">
          <div className="turn-indicator">
            <span className={turn} />
            {winner
              ? `${winner === 'cho' ? '초' : '한'}의 승리`
              : turn === 'cho'
                ? '초의 차례'
                : '한의 차례'}
            {trialSnapshot && <b className="trial-badge">둬보기</b>}
          </div>
          <div className="board-frame">
            <div
              className={`board ${illegalMove ? 'illegal-move' : ''}`}
              role="grid"
              aria-label="장기판 연출 프로토타입"
              onClick={handleBoardClick}
              onKeyDown={handleBoardKeyDown}
              tabIndex={0}
            >
              <div className="river-mark">楚 河　　漢 界</div>
              <div className="palace palace-top" />
              <div className="palace palace-bottom" />
              <JanggiBoardMarks />
              {targets.map((t) => (
                <button
                  key={`${t.x}-${t.y}`}
                  className="move-target"
                  onClick={() => move(t.x, t.y)}
                  aria-label={`${t.x + 1}열 ${t.y + 1}행으로 이동`}
                  style={{ left: `${t.x * 12.5}%`, top: `${t.y * (100 / 9)}%` }}
                />
              ))}
              {pieces.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choose(p)}
                  className={`piece ${p.side} piece-${p.kind} ${
                    ['pawn', 'guard'].includes(p.kind)
                      ? 'piece-small'
                      : p.kind === 'king'
                        ? 'piece-king'
                        : 'piece-medium'
                  } ${selected === p.id ? 'selected' : ''} ${
                    motion?.id === p.id
                      ? motion.capture
                        ? 'moving capturing'
                        : 'moving'
                      : ''
                  }`}
                  style={{ left: `${p.x * 12.5}%`, top: `${p.y * (100 / 9)}%` }}
                  aria-label={`${p.side === 'cho' ? '초' : '한'} ${p.name}`}
                >
                  <span>{pieceLabel(p)}</span>
                </button>
              ))}
              {impact && (
                <div
                  className={`impact impact-tier-${impact.tier}`}
                  style={{
                    left: `${impact.x * 12.5}%`,
                    top: `${impact.y * (100 / 9)}%`,
                  }}
                >
                  <i />
                  <b>{impact.label}</b>
                </div>
              )}
              {winner && (
                <output className={`mate-banner `}>
                  <span>CHECKMATE</span>
                  <strong>외통</strong>
                  <b>{winner === 'cho' ? '초' : '한'} 승리</b>
                </output>
              )}
            </div>
          </div>
          <div className={`status-strip ${illegalMove ? 'illegal-status' : ''}`} aria-live="polite">
            <span className="status-dot" />
            <p>{status}</p>
            <kbd>CLICK</kbd>
          </div>
        </div>
        <Player side="cho" active={turn === 'cho'} />
      </section>
      <footer>
        <span>
          연출 강도 <b>{cinema ? '시네마틱' : '절제'}</b>
        </span>
        <span className="hint">
          <Sparkles size={14} /> 기물을 선택하면 실제 행마가 표시됩니다
        </span>
        <span>
          포획 <b>{32 - pieces.length}</b>
        </span>
      </footer>
    </main>
  );
}
function FormationDialog({ open, cho, han, onCho, onHan, onStart }: { open: boolean; cho: Formation; han: Formation; onCho: (formation: Formation) => void; onHan: (formation: Formation) => void; onStart: () => void }) {
  return <Dialog open={open} onOpenChange={() => {}}>
    <DialogContent className="formation-dialog" showCloseButton={false}>
      <DialogHeader>
        <span className="formation-eyebrow">BATTLE FORMATION</span>
        <DialogTitle>시작 포진을 정하세요</DialogTitle>
        <DialogDescription>마와 상의 좌우 배치를 선택하면 장기판에 바로 반영됩니다.</DialogDescription>
      </DialogHeader>
      <FormationSide side="han" value={han} onChange={onHan} />
      <FormationSide side="cho" value={cho} onChange={onCho} />
      <button className="formation-start" onClick={onStart}><Swords size={18} /> 이 포진으로 대국 시작</button>
    </DialogContent>
  </Dialog>;
}
function FormationSide({ side, value, onChange }: { side: Side; value: Formation; onChange: (formation: Formation) => void }) {
  return <fieldset className={`formation-side ${side}`}>
    <legend><b>{side === 'cho' ? '초 · 楚' : '한 · 漢'}</b><span>{side === 'cho' ? '아래 진영' : '위 진영'}</span></legend>
    <div className="formation-options">
      {formations.map((formation) => <button type="button" key={formation.value} className={value === formation.value ? 'selected' : ''} aria-pressed={value === formation.value} onClick={() => onChange(formation.value)}>
        <span className="formation-pieces"><i>車</i>{formation.order.map((kind, index) => <b key={`${kind}-${index}`}>{kind === 'horse' ? '馬' : '象'}</b>)}<i>車</i></span>
        <strong>{formation.label}</strong>
      </button>)}
    </div>
  </fieldset>;
}
function Player({ side, active }: { side: Side; active: boolean }) {
  const cho = side === 'cho';
  return (
    <aside className={`player-card ${side}-card`}>
      <div>
        <span className="side-label">{cho ? '푸른 진영' : '붉은 진영'}</span>
        <h2>{cho ? '초 · 楚' : '한 · 漢'}</h2>
      </div>
      <div className={`avatar ${side}-avatar`}>{cho ? '楚' : '漢'}</div>
      <div className={`clock ${active ? 'active-clock' : ''}`}>
        {cho ? '10:00' : '09:42'}
      </div>
      <p>{active ? '당신의 차례입니다' : '상대가 생각하는 중'}</p>
    </aside>
  );
}
