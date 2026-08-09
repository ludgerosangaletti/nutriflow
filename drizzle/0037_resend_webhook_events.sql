CREATE TABLE `resend_webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`provider_email_id` text,
	`occurred_at` text,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resend_webhook_events_provider_id_unique` ON `resend_webhook_events` (`provider_event_id`);
