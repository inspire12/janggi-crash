import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  elo: integer('elo').notNull().default(1200),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  termsAcceptedAt: integer('terms_accepted_at').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const matchmakingQueue = sqliteTable('matchmaking_queue', {
  userId: text('user_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  elo: integer('elo').notNull(),
  joinedAt: integer('joined_at').notNull(),
}, (table) => [index('idx_queue_joined_at').on(table.joinedAt)]);

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  choUserId: text('cho_user_id').notNull().references(() => players.id),
  hanUserId: text('han_user_id').notNull().references(() => players.id),
  status: text('status').notNull().default('active'),
  turn: text('turn').notNull().default('cho'),
  boardJson: text('board_json').notNull(),
  version: integer('version').notNull().default(0),
  winnerUserId: text('winner_user_id').references(() => players.id),
  resultReason: text('result_reason'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_matches_cho_status').on(table.choUserId, table.status),
  index('idx_matches_han_status').on(table.hanUserId, table.status),
]);

export const moves = sqliteTable('moves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  ply: integer('ply').notNull(),
  userId: text('user_id').notNull().references(() => players.id),
  pieceId: text('piece_id').notNull(),
  fromX: integer('from_x').notNull(),
  fromY: integer('from_y').notNull(),
  toX: integer('to_x').notNull(),
  toY: integer('to_y').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_moves_match_ply').on(table.matchId, table.ply),
]);
