CREATE TABLE `whatsapp_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wa_id` text NOT NULL,
	`phone` text NOT NULL,
	`profile_name` text,
	`service_interest` text DEFAULT 'unknown' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`interaction_count` integer DEFAULT 1 NOT NULL,
	`last_interaction_kind` text DEFAULT 'text' NOT NULL,
	`marketing_opt_in` integer DEFAULT false NOT NULL,
	`marketing_opt_in_at` text,
	`marketing_opt_out_at` text,
	`qualified_at` text,
	`first_contact_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_contact_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_leads_wa_id_unique` ON `whatsapp_leads` (`wa_id`);