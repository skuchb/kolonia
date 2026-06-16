CREATE TABLE `results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`mode` text NOT NULL,
	`puzzle` integer NOT NULL,
	`attempts` integer NOT NULL,
	`solved` integer NOT NULL,
	`points` integer NOT NULL,
	`camp` text,
	`ip_hash` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_mode_puzzle_ip` ON `results` (`mode`,`puzzle`,`ip_hash`);