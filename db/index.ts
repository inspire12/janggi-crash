import { env } from 'cloudflare:workers';
import postgres from 'postgres';
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
    if (!env.DATABASE_URL) throw new Error('Supabase DATABASE_URL is not configured.');
    // A Worker request must not reuse another request's TCP socket.
    const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 1, ssl: localTestingEnabled() ? false : 'require' });
    try {
      return await sql.begin(async tx => {
        if (lock !== undefined) await tx`SELECT pg_advisory_xact_lock(${lock})`;
        const db = new Database(async (text, values) => {
          const rows = await tx.unsafe(text, values);
          const results = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
            [key, typeof value === 'string' && /^(?:created_at|updated_at|joined_at|terms_accepted_at|turn_started_at|member_count)$/.test(key) ? Number(value) : value],
          )));
          return { success: true, results, meta: { changes: rows.count ?? 0 } };
        });
        return work(db);
      }) as T;
    } finally { await sql.end({ timeout: 1 }); }
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
