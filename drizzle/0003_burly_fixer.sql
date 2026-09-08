CREATE TABLE `friendships` (
	`pair_key` text PRIMARY KEY NOT NULL,
	`requester_user_id` text NOT NULL,
	`addressee_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`requester_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_friendships_requester` ON `friendships` (`requester_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_friendships_addressee` ON `friendships` (`addressee_user_id`,`status`);