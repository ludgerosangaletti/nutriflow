CREATE TABLE `check_ins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`week_start` text NOT NULL,
	`weight_kg` text,
	`adherence` integer NOT NULL,
	`hunger` integer NOT NULL,
	`satiety` integer NOT NULL,
	`sleep` integer NOT NULL,
	`energy` integer NOT NULL,
	`training_sessions` integer DEFAULT 0 NOT NULL,
	`bowel_function` text NOT NULL,
	`main_difficulty` text DEFAULT '' NOT NULL,
	`weekly_win` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`admin_status` text DEFAULT 'new' NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_client_week_unique` ON `check_ins` (`client_email`,`week_start`);