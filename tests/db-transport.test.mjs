import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function fixture(local, fail = false) {
  const calls = [];
  let config;
  class Client {
    connection = { on() {} };
    constructor(value) { config = value; }
    on() {}
    async connect() { calls.push('CONNECT'); }
    async query(text) {
      calls.push(text);
      if (fail && text === 'SELECT 1') throw new Error('test failure');
      return { rows: [], rowCount: 0 };
    }
    async end() { calls.push('END'); }
  }
  const imports = {
    'cloudflare:workers': { env: { DATABASE_URL: 'postgresql://localhost/local', HYPERDRIVE: { connectionString: 'postgresql://internal/production' } } },
    'pg': { Client },
    '@/lib/local-testing': { localTestingEnabled: () => local },
  };
  const context = vm.createContext({ Date, console: { error() {} } });
  const source = ts.transpileModule(readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(name => new vm.SyntheticModule(Object.keys(imports[name]), function () {
    for (const [key, value] of Object.entries(imports[name])) this.setExport(key, value);
  }, { context }));
  await mod.evaluate();
  return { db: mod.namespace.getDatabase(), calls, config: () => config };
}

test('production uses Hyperdrive without a second TLS handshake', async () => {
  const f = await fixture(false);
  await f.db.prepare('SELECT 1').all();
  assert.equal(f.config().connectionString, 'postgresql://internal/production');
  assert.equal(Object.hasOwn(f.config(), 'ssl'), false);
  assert.deepEqual(f.calls, ['CONNECT', 'BEGIN', 'SELECT 1', 'COMMIT', 'END']);
});
test('local testing never uses the production binding', async () => {
  const f = await fixture(true);
  await f.db.prepare('SELECT 1').all();
  assert.equal(f.config().connectionString, 'postgresql://localhost/local');
  assert.equal(f.config().ssl, false);
});
test('failed query rolls back and closes without retrying', async () => {
  const f = await fixture(false, true);
  await assert.rejects(f.db.prepare('SELECT 1').all());
  assert.deepEqual(f.calls, ['CONNECT', 'BEGIN', 'SELECT 1', 'ROLLBACK', 'END']);
});
