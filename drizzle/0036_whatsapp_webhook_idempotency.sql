CREATE TABLE `whatsapp_webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_event_id` text NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_webhook_events_provider_id_unique` ON `whatsapp_webhook_events` (`provider_event_id`);
