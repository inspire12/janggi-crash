ALTER TABLE `matches` ADD `previous_board_json` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `previous_turn` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `previous_cho_time_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `previous_han_time_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `takeback_requested_by` text REFERENCES players(id);