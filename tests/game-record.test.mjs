import test from 'node:test';
import assert from 'node:assert/strict';
import { replayRecord } from '../lib/game-record.ts';

const event = (seq, kind, details = {}) => ({ seq, kind, details, state: { board: [], turn: 'cho', choTimeMs: 600000 - seq, hanTimeMs: 600000, status: kind === 'resign' ? 'finished' : 'active' }, created_at: seq });
test('move, takeback, alternate move and resignation preserve full history', () => {
  const events = [event(0,'start'),event(1,'move'),event(2,'move'),event(3,'takeback',{undoneSeq:2}),event(4,'move'),event(5,'resign')];
  const result = replayRecord(events);
  assert.equal(result.complete,true);
  assert.equal(result.timeline.length,6);
  assert.deepEqual(result.finalMoves.map(x => [x.ply,x.event.seq]),[[1,1],[2,4]]);
  assert.equal(result.current.status,'finished');
  assert.equal(events.length,6);
});
test('legacy checkpoint does not claim a complete record', () => {
  assert.equal(replayRecord([event(0,'checkpoint'),event(1,'takeback',{undoneSeq:0})]).complete,false);
});
test('missing pages and invalid takebacks are rejected', () => {
  assert.throws(() => replayRecord([event(0,'start'),event(2,'move')]));
  assert.throws(() => replayRecord([event(0,'start'),event(1,'takeback',{undoneSeq:0})]));
});
