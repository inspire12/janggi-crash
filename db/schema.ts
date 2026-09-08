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
  allowTakebackRequests: integer('allow_takeback_requests').notNull().default(1),
  termsAcceptedAt: integer('terms_accepted_at').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const matchmakingQueue = sqliteTable('matchmaking_queue', {
  userId: text('user_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  elo: integer('elo').notNull(),
  formation: text('formation').notNull().default('horse-elephant-elephant-horse'),
  joinedAt: integer('joined_at').notNull(),
}, (table) => [index('idx_queue_joined_at').on(table.joinedAt)]);

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  choUserId: text('cho_user_id').notNull().references(() => players.id),
  hanUserId: text('han_user_id').notNull().references(() => players.id),
  status: text('status').notNull().default('active'),
  turn: text('turn').notNull().default('cho'),
  boardJson: text('board_json').notNull(),
  previousBoardJson: text('previous_board_json'),
  previousTurn: text('previous_turn'),
  previousChoTimeMs: integer('previous_cho_time_ms'),
  previousHanTimeMs: integer('previous_han_time_ms'),
  takebackRequestedBy: text('takeback_requested_by').references(() => players.id),
  version: integer('version').notNull().default(0),
  winnerUserId: text('winner_user_id').references(() => players.id),
  resultReason: text('result_reason'),
  choTimeMs: integer('cho_time_ms').notNull().default(600000),
  hanTimeMs: integer('han_time_ms').notNull().default(600000),
  turnStartedAt: integer('turn_started_at').notNull().default(0),
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

export const guilds = sqliteTable('guilds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id').notNull().references(() => players.id),
  createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('idx_guilds_name').on(table.name)]);

export const guildMembers = sqliteTable('guild_members', {
  userId: text('user_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  joinedAt: integer('joined_at').notNull(),
}, (table) => [index('idx_guild_members_guild').on(table.guildId)]);

export const friendships = sqliteTable('friendships', {
  pairKey: text('pair_key').primaryKey(),
  requesterUserId: text('requester_user_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  addresseeUserId: text('addressee_user_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_friendships_requester').on(table.requesterUserId, table.status),
  index('idx_friendships_addressee').on(table.addresseeUserId, table.status),
]);

export const blockedPlayers = sqliteTable('blocked_players', {
  blockerUserId: text('blocker_user_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  blockedUserId: text('blocked_user_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('idx_blocked_pair').on(table.blockerUserId, table.blockedUserId)]);

export const matchChats = sqliteTable('match_chats', {
  matchId: text('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  requesterUserId: text('requester_user_id').notNull().references(() => players.id),
  status: text('status').notNull().default('pending'),
  updatedAt: integer('updated_at').notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id').notNull().references(() => players.id),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_chat_messages_match').on(table.matchId, table.createdAt)]);
