CREATE TABLE `renewal_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`access_expires_at` text NOT NULL,
	`days_before` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `renewal_reminders_cycle_day_unique` ON `renewal_reminders` (`client_email`,`access_expires_at`,`days_before`);