ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
CREATE TABLE `content_npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`admin_note` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`data_json` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`quality_status` text DEFAULT 'ok' NOT NULL,
	`admin_note` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image_url` text NOT NULL,
	`image_width` integer NOT NULL,
	`image_height` integer NOT NULL,
	`meters_per_pixel` real DEFAULT 2.5 NOT NULL,
	`default_tolerance_meters` real DEFAULT 80 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `map_puzzles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`map_id` text NOT NULL,
	`npc_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`tolerance_meters` real,
	`chapter_pl` text,
	`chapter_en` text,
	`chapter_de` text,
	`label` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_puzzles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puzzle` integer NOT NULL,
	`mode` text NOT NULL,
	`npc_id` text,
	`quote_id` text,
	`map_puzzle_id` integer,
	`published` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_puzzle_mode_day` ON `daily_puzzles` (`puzzle`,`mode`);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`progress_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_solves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`mode` text NOT NULL,
	`puzzle` integer NOT NULL,
	`attempts` integer NOT NULL,
	`xp_earned` integer NOT NULL,
	`distance_meters` real,
	`solved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_solve` ON `user_solves` (`user_id`,`mode`,`puzzle`);
--> statement-breakpoint
CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details_json` text,
	`ts` integer NOT NULL
);
