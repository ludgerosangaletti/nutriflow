CREATE TABLE `appointment_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`appointment_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`patient_provider_id` text,
	`admin_provider_id` text,
	`whatsapp_status` text DEFAULT 'not_configured' NOT NULL,
	`whatsapp_provider_id` text,
	`error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_reminders_client_date_unique` ON `appointment_reminders` (`client_email`,`appointment_at`);