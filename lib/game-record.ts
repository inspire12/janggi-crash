import type { Piece, Side } from './janggi';

export type RecordState = {
  board: Piece[]; turn: Side; choTimeMs: number; hanTimeMs: number;
  status: string; winnerUserId: string | null; resultReason: string | null;
};
export type RecordEvent = {
  seq: number;
  kind: 'start' | 'checkpoint' | 'move' | 'takeback' | 'resign' | 'timeout';
  details: { undoneSeq?: number; [key: string]: unknown };
  state: RecordState;
  created_at: number;
};

// Assemble all pages first. Snapshots deliberately avoid re-running a newer
// rules engine over an older game's history.
export function replayRecord(events: RecordEvent[]) {
  if (!events.length || events[0].seq !== 0 || !['start', 'checkpoint'].includes(events[0].kind)) {
    throw new Error('기보의 시작 지점이 없습니다.');
  }
  const finalMoves: RecordEvent[] = [];
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (event.seq !== index) throw new Error('기보 일부가 누락되었습니다.');
    if (event.kind === 'move') finalMoves.push(event);
    if (event.kind === 'takeback') {
      if (finalMoves.at(-1)?.seq === event.details.undoneSeq) finalMoves.pop();
      else if (events[0].kind !== 'checkpoint') throw new Error('무르기 대상 수를 찾을 수 없습니다.');
    }
  }
  return {
    complete: events[0].kind === 'start',
    timeline: events,
    finalMoves: finalMoves.map((event, index) => ({ ply: index + 1, event })),
    current: events.at(-1)!.state,
  };
}
