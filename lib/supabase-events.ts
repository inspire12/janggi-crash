import { env } from 'cloudflare:workers';

export type MatchEvent =
  | 'move'
  | 'takeback-request'
  | 'takeback-accept'
  | 'takeback-reject'
  | 'resign'
  | 'timeout'
  | 'checkmate';

export function hasSupabaseRealtime() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

export function publicSupabaseConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  return { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY };
}

export async function publishMatchEvent(matchId: string, version: number, event: MatchEvent) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const response = await fetch(
      `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/match_events?on_conflict=match_id`,
      {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ match_id: matchId, version, event }),
        signal: AbortSignal.timeout(2000),
      },
    );
    return response.ok;
  } catch {
    // Realtime is an acceleration layer. D1 remains authoritative and clients
    // retain a polling fallback, so a relay outage must never reject a move.
    return false;
  }
}
