ALTER TABLE `results` ADD `event` text DEFAULT 'solve' NOT NULL;
--> statement-breakpoint
DROP INDEX `uq_mode_puzzle_ip`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_mode_puzzle_ip_event` ON `results` (`mode`,`puzzle`,`ip_hash`,`event`);
