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
};

export async function ensurePlayer(user: ChatGPTUser) {
  const db = getDatabase();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO players
       (id, email, display_name, elo, wins, losses, draws, streak, created_at, updated_at)
       VALUES (?, ?, ?, 1200, 0, 0, 0, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`,
    )
    .bind(user.userId, user.email, user.displayName, now, now)
    .run();
  return db
    .prepare(
      `SELECT id, email, display_name, elo, wins, losses, draws, streak
       FROM players WHERE id = ?`,
    )
    .bind(user.userId)
    .first<PlayerProfile>();
}
