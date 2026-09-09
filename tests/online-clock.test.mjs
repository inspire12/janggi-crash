import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { readClock, timeControls } from '../lib/game-clock.ts';

async function fixture(mode, elapsed) {
  const match = { id: 'match', cho_user_id: 'cho', han_user_id: 'han', status: 'active', turn: 'cho', board_json: '[]', version: 0,
    time_control: mode, cho_time_ms: mode === 'blitz' ? 180000 : 600000, han_time_ms: 600000, turn_started_at: 1000 };
  const batches = [];
  const profile = { id: 'han', terms_accepted_at: 1, elo: 1200, allow_takeback_requests: 1 };
  const db = {
    prepare(sql) { return { sql, bind(...args) { this.args = args; return this; }, async first() { return sql.includes('FROM matches') ? { ...match } : profile; } }; },
    async batch(statements) {
      if (match.status !== 'active') return [{ success: true, meta: { changes: 0 } }];
      batches.push(statements);
      match.status = 'finished';
      return [{ success: true, meta: { changes: 1 } }];
    },
  };
  const imports = {
    '@/app/auth': { getAppUser: async () => ({ userId: 'han' }) },
    '@/db': { getDatabase: () => db },
    '@/db/players': { getPlayer: async () => profile },
    '@/lib/janggi': { applyMove: () => [], isCheckmate: () => false, legalMoves: () => [] },
    '@/lib/rating': { eloChange: () => 16, rankForElo: () => ({ name: '18급' }) },
    '@/lib/supabase-events': { publishMatchEvent: async () => {} },
    '@/lib/game-clock': { readClock, timeControls },
  };
  const context = vm.createContext({ Response, URL, Date: class extends Date { static now() { return 1000 + elapsed; } } });
  const source = ts.transpileModule(readFileSync(new URL('../app/api/matches/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = imports[specifier];
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, batches };
}

for (const [mode, control] of Object.entries(timeControls)) {
  test(`${mode}: server exposes remaining overtime after main time`, async () => {
    const { api } = await fixture(mode, control.mainMs + 1000);
    const data = await (await api.GET(new Request('https://game.test/api/matches?id=match'))).json();
    assert.equal(data.match.choTimeMs, control.periodMs - 1000);
    assert.equal(data.match.periodMs, control.periodMs);
  });
  test(`${mode}: premature timeout claims cannot end a game`, async () => {
    const { api, batches } = await fixture(mode, control.mainMs + control.periodMs - 1);
    const response = await api.POST(new Request('https://game.test/api/matches', { method: 'POST', body: JSON.stringify({ matchId: 'match', action: 'claim-timeout' }) }));
    assert.equal(response.status, 409);
    assert.equal(batches.length, 0);
  });
  test(`${mode}: opponent can claim timeout exactly once`, async () => {
    const { api, batches } = await fixture(mode, control.mainMs + control.periodMs);
    const request = () => new Request('https://game.test/api/matches', { method: 'POST', body: JSON.stringify({ matchId: 'match', action: 'claim-timeout' }) });
    assert.equal((await api.POST(request())).status, 200);
    assert.equal(batches[0][0].args[0], 'han');
    assert.equal(batches[0][0].args[1], 'timeout');
    assert.equal((await api.POST(request())).status, 409);
    assert.equal(batches.length, 1);
  });
}
