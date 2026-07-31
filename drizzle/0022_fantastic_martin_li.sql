CREATE TABLE `nf_idempotency_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`response_json` text,
	`error_code` text,
	`correlation_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_idempotency_keys_scope_key_unique` ON `nf_idempotency_keys` (`organization_id`,`operation`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `nf_idempotency_keys_expiry_idx` ON `nf_idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `nf_idempotency_keys_correlation_idx` ON `nf_idempotency_keys` (`correlation_id`);--> statement-breakpoint
ALTER TABLE `nf_event_consumptions` ADD `available_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `nf_event_consumptions` ADD `processing_started_at` text;--> statement-breakpoint
ALTER TABLE `nf_event_consumptions` ADD `lease_token` text;--> statement-breakpoint
CREATE INDEX `nf_event_consumptions_dispatch_idx` ON `nf_event_consumptions` (`status`,`available_at`);--> statement-breakpoint
ALTER TABLE `nf_outbox_events` ADD `processing_started_at` text;--> statement-breakpoint
ALTER TABLE `nf_outbox_events` ADD `lease_token` text;
