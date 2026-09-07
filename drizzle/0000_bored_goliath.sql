CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`cho_user_id` text NOT NULL,
	`han_user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`turn` text DEFAULT 'cho' NOT NULL,
	`board_json` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`winner_user_id` text,
	`result_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cho_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`han_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_cho_status` ON `matches` (`cho_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_matches_han_status` ON `matches` (`han_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `matchmaking_queue` (
	`user_id` text PRIMARY KEY NOT NULL,
	`elo` integer NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_queue_joined_at` ON `matchmaking_queue` (`joined_at`);--> statement-breakpoint
CREATE TABLE `moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`ply` integer NOT NULL,
	`user_id` text NOT NULL,
	`piece_id` text NOT NULL,
	`from_x` integer NOT NULL,
	`from_y` integer NOT NULL,
	`to_x` integer NOT NULL,
	`to_y` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_moves_match_ply` ON `moves` (`match_id`,`ply`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`elo` integer DEFAULT 1200 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
