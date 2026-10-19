CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`kind` text NOT NULL,
	`question` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`format` text NOT NULL,
	`options` text NOT NULL,
	`answer` text NOT NULL,
	`points` integer NOT NULL,
	`published` integer NOT NULL,
	`opens` integer NOT NULL,
	`closes` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `solves` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`question` text NOT NULL,
	`points` integer NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_solve` ON `solves` (`team`,`question`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_code_unique` ON `teams` (`code`);--> statement-breakpoint
CREATE TABLE `throttles` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL
);
