import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { getDatabase } from './index';

export type PlayerProfile = {
  id: string;
  email: string;
  display_name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  allow_takeback_requests: number;
  terms_accepted_at: number;
};

export async function getPlayer(userId: string) {
  return getDatabase()
    .prepare(
      `SELECT id, email, display_name, elo, wins, losses, draws, streak,
              allow_takeback_requests, terms_accepted_at
       FROM players WHERE id = ?`,
    )
    .bind(userId)
    .first<PlayerProfile>();
}

export async function createPlayer(user: ChatGPTUser, displayName: string) {
  const db = getDatabase();
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO players
       (id, email, display_name, elo, wins, losses, draws, streak, terms_accepted_at, created_at, updated_at)
       VALUES (?, ?, ?, 1200, 0, 0, 0, 0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         terms_accepted_at = excluded.terms_accepted_at,
         updated_at = excluded.updated_at
       WHERE players.terms_accepted_at = 0`,
    )
    .bind(user.userId, user.email, displayName, now, now, now)
    .run();
  return { created: result.meta.changes === 1, profile: await getPlayer(user.userId) };
}
