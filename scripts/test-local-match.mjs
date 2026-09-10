import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legalMoves } from '../lib/janggi.ts';

const origin = process.env.LOCAL_TEST_ORIGIN ?? 'http://localhost:3000';
const target = new URL(origin);
if (origin !== 'http://localhost:3000' && !(target.protocol === 'https:' && target.hostname.endsWith('.trycloudflare.com'))) throw new Error('Only localhost or an explicitly selected test tunnel is allowed.');
const credentials = JSON.parse(readFileSync('.local-testing.json', 'utf8'));
function session(slot) {
  const cookies = new Map();
  return async (path, body) => {
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: {
      origin, 'content-type': 'application/json', cookie: [...cookies].map(([key,value]) => `${key}=${value}`).join('; '),
    }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const at = pair.indexOf('='); cookies.set(pair.slice(0,at),pair.slice(at+1));
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${slot} ${path}: HTTP ${response.status} ${data.error ?? ''}`);
    return data;
  };
}
const a = session('a'), b = session('b');
for (const [slot, api] of [['a',a],['b',b]]) {
  await api('/api/dev-login', { slot, password: credentials[slot].password });
  assert.equal((await api('/api/account')).registered, true);
  const previous = await api('/api/matchmaking');
  if (previous.matchId) await api('/api/matches', { matchId: previous.matchId, action: 'resign' });
  await api('/api/matchmaking', { action: 'cancel' });
}
console.log('PASS: two independent authenticated test sessions');
const formation = 'horse-elephant-elephant-horse';
assert.equal((await a('/api/matchmaking', { action: 'join', formation, timeControl: 'standard' })).queued, true);
assert.equal((await b('/api/matchmaking', { action: 'join', formation, timeControl: 'blitz' })).queued, true);
console.log('PASS: standard and blitz queues stay separate');
await b('/api/matchmaking', { action: 'cancel' });
const paired = await b('/api/matchmaking', { action: 'join', formation, timeControl: 'standard' });
assert.ok(paired.matchId);
assert.equal((await a('/api/matchmaking')).matchId, paired.matchId);
const matchPath = `/api/matches?id=${paired.matchId}`;
const initialA = await a(matchPath), initialB = await b(matchPath);
assert.notEqual(initialA.you.side, initialB.you.side);
assert.deepEqual(initialA.match.board, initialB.match.board);
const mover = initialA.you.side === 'cho' ? a : b;
const opponent = mover === a ? b : a;
const piece = initialA.match.board.find(p => p.side === 'cho' && legalMoves(p,initialA.match.board).length);
const to = legalMoves(piece,initialA.match.board)[0];
await mover('/api/matches', { matchId: paired.matchId, action: 'move', pieceId: piece.id, to, version: initialA.match.version });
const moved = await opponent(matchPath);
assert.equal(moved.match.version, 1);
assert.equal(moved.match.turn, 'han');
await mover('/api/matches', { matchId: paired.matchId, action: 'takeback-request' });
assert.equal((await opponent(matchPath)).match.takebackRequestedByMe, false);
await opponent('/api/matches', { matchId: paired.matchId, action: 'takeback-reject' });
assert.equal((await mover(matchPath)).match.takebackRequested, false);
await mover('/api/matches', { matchId: paired.matchId, action: 'takeback-request' });
await opponent('/api/matches', { matchId: paired.matchId, action: 'takeback-accept' });
assert.deepEqual((await mover(matchPath)).match.board, initialA.match.board);
await mover('/api/matches', { matchId: paired.matchId, action: 'resign' });
assert.equal((await opponent(matchPath)).match.status, 'finished');
const ranked = await opponent(matchPath);
assert.ok(ranked.rankResult);
assert.ok(ranked.rankResult.after_score >= ranked.rankResult.before_score);
const loserRank = (await mover(matchPath)).rankResult;
assert.ok(loserRank.after_score <= loserRank.before_score);
assert.deepEqual((await opponent(matchPath)).rankResult,ranked.rankResult);
assert.ok((await a(`/api/records?id=${paired.matchId}`)).events.length >= 4);
console.log('PASS: matching, move sync, takeback rejection/acceptance, resignation and record persistence');
