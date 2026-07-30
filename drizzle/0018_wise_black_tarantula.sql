CREATE TABLE `appointment_change_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`current_appointment_at` text NOT NULL,
	`requested_appointment_at` text,
	`action` text DEFAULT 'reschedule' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text DEFAULT 'whatsapp' NOT NULL,
	`admin_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
ALTER TABLE `appointment_reminders` ADD `pending_alert_sent_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `appointment_status` text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `appointment_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `appointment_confirmation_source` text;