CREATE TABLE `question_starts` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`question` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_start` ON `question_starts` (`team`,`question`);--> statement-breakpoint
ALTER TABLE `solves` ADD `duration` integer;