CREATE TABLE `blocked_players` (
	`blocker_user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`blocker_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blocked_pair` ON `blocked_players` (`blocker_user_id`,`blocked_user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_match` ON `chat_messages` (`match_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guild_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_guild_members_guild` ON `guild_members` (`guild_id`);--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_guilds_name` ON `guilds` (`name`);--> statement-breakpoint
CREATE TABLE `match_chats` (
	`match_id` text PRIMARY KEY NOT NULL,
	`requester_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `matches` ADD `cho_time_ms` integer DEFAULT 600000 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `han_time_ms` integer DEFAULT 600000 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `turn_started_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `matches` SET `turn_started_at` = `updated_at` WHERE `turn_started_at` = 0;
--> statement-breakpoint
PRAGMA optimize;
