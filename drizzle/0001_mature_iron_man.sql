CREATE TABLE `anamneses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anamneses_client_email_unique` ON `anamneses` (`client_email`);