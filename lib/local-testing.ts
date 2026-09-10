import { env } from 'cloudflare:workers';

export function localTestingEnabled() {
  if (process.env.NODE_ENV === 'production' || env.DEV_TEST_LOGIN !== 'true') return false;
  try {
    const auth = new URL(env.SUPABASE_URL ?? '');
    const db = new URL(env.DATABASE_URL ?? '');
    return auth.protocol === 'http:' && auth.hostname === '127.0.0.1' && auth.port === '54321'
      && db.protocol === 'postgresql:' && db.hostname === '127.0.0.1' && db.port === '54322';
  } catch { return false; }
}
