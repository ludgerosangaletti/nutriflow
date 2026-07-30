CREATE TABLE `google_calendar_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`encrypted_client_id` text NOT NULL,
	`encrypted_client_secret` text NOT NULL,
	`encrypted_refresh_token` text,
	`status` text DEFAULT 'credentials_saved' NOT NULL,
	`connected_at` text,
	`last_sync_at` text,
	`last_sync_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `google_calendar_event_id` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `google_calendar_synced_at` text;