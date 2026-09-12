import { env } from 'cloudflare:workers';
import { Client } from 'pg';
import { localTestingEnabled } from '@/lib/local-testing';

type Value = string | number | boolean | null;
type Result<T = Record<string, unknown>> = { success: boolean; results: T[]; meta: { changes: number } };
type Query = (text: string, values: Value[]) => Promise<Result>;

class Statement {
  constructor(readonly db: Database, readonly text: string, readonly values: Value[] = []) {}
  bind(...values: Value[]) { return new Statement(this.db, this.text, values); }
  async all<T = Record<string, unknown>>() { return await this.db.query(this.text, this.values) as Result<T>; }
  async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  run() { return this.all(); }
}

function parameters(text: string) {
  let index = 0;
  return text.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, token => token === '?' ? `$${++index}` : token);
}

class Database {
  constructor(private readonly execute?: Query) {}
  prepare(text: string) { return new Statement(this, text); }
  async query(text: string, values: Value[]): Promise<Result> {
    if (this.execute) return this.execute(parameters(text), values);
    return this.transaction(db => db.query(text, values));
  }
  async transaction<T>(work: (db: Database) => Promise<T>, lock?: number): Promise<T> {
    if (this.execute) return work(this);
    const local = localTestingEnabled();
    const hyperdrive = !local && env.HYPERDRIVE;
    const connectionString = hyperdrive ? hyperdrive.connectionString : env.DATABASE_URL;
    if (!connectionString) throw new Error('Database connection is not configured.');
    // A Worker request must not reuse another request's TCP socket.
    // Hyperdrive's private binding handles TLS to the origin with verify-full.
    // Do not initiate a second TLS handshake against the internal binding.
    const sql = new Client({ connectionString, connectionTimeoutMillis: 8000, statement_timeout: 10000, ...(hyperdrive ? {} : { ssl: local ? false : { rejectUnauthorized: true } }) });
    // No implicit reconnect/replay: a failed write must not be executed twice.
    sql.on('error', () => { /* query/connect promises report sanitized errors below */ });
    const started = Date.now();
    let stage = 'connect';
    let handshake = 'socket';
    const connection = (sql as unknown as { connection: { on: (event: string, listener: () => void) => void } }).connection;
    for (const event of ['connect', 'sslconnect', 'authenticationSASL', 'authenticationSASLContinue', 'authenticationSASLFinal', 'readyForQuery']) {
      connection.on(event, () => { handshake = event; });
    }
    try {
      await sql.connect();
      await sql.query('BEGIN');
        stage = 'transaction';
        if (lock !== undefined) await sql.query('SELECT pg_advisory_xact_lock($1)', [lock]);
        const db = new Database(async (text, values) => {
          const rows = await sql.query(text, values);
          const results = rows.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
            [key, typeof value === 'string' && /^(?:created_at|updated_at|joined_at|terms_accepted_at|turn_started_at|member_count)$/.test(key) ? Number(value) : value],
          )));
          return { success: true, results, meta: { changes: rows.rowCount ?? 0 } };
        });
        const result = await work(db);
        await sql.query('COMMIT');
        return result;
    } catch (error) {
      if (stage === 'transaction') await sql.query('ROLLBACK').catch(() => {});
      const code = (error as { code?: unknown } | null)?.code;
      const rawMessage = (error as { message?: unknown } | null)?.message;
      const message = typeof rawMessage === 'string' ? rawMessage : typeof error === 'string' ? error : '';
      const category = /subrequests/i.test(message) ? 'WORKER_SUBREQUEST_LIMIT'
        : /password authentication|SASL/i.test(message) ? 'DB_AUTH_FAILED'
        : /timeout|timed out/i.test(message) ? 'DB_TIMEOUT'
        : /certificate|TLS|SSL/i.test(message) ? 'DB_TLS_FAILED'
        : /Tenant or user not found/i.test(message) ? 'DB_POOLER_USER_INVALID'
        : /CPU time/i.test(message) ? 'WORKER_CPU_LIMIT'
        : /Connection terminated|connection closed/i.test(message) ? 'DB_CONNECTION_TERMINATED'
        : /not implemented|not supported|unsupported/i.test(message) ? 'RUNTIME_UNSUPPORTED'
        : /is not a function/i.test(message) ? 'RUNTIME_TYPE_ERROR' : 'UNKNOWN';
      const allowed = ['28P01', '28000', '42501', '42P01', '42703', '53300', '57P01', 'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'];
      console.error('db-diagnostic', { stage, handshake, transport: hyperdrive ? 'hyperdrive' : 'direct', elapsedMs: Date.now() - started, category, code: typeof code === 'string' && allowed.includes(code) ? code : 'UNCLASSIFIED' });
      throw error;
    } finally { await sql.end().catch(() => {}); }
  }
  async batch(statements: Statement[], requireFirstChange = false) {
    return this.transaction(async db => {
      const results: Result[] = [];
      for (const statement of statements) {
        const result = await db.query(statement.text, statement.values);
        results.push(result);
        if (requireFirstChange && results.length === 1 && result.meta.changes !== 1) break;
      }
      return results;
    });
  }
}

export function getDatabase() { return new Database(); }
