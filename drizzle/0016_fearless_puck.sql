ALTER TABLE `clients` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `modality` text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `profile_completed_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `invite_status` text DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `invite_sent_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `invite_accepted_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `invite_error` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `next_appointment_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `appointment_location` text;