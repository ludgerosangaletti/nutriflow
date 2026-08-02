ALTER TABLE `clients` ADD `whatsapp_activation_opt_in_at` text;
--> statement-breakpoint
CREATE TABLE `patient_activation_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`delivery_key` text NOT NULL,
	`kind` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_activation_messages_delivery_key_unique` ON `patient_activation_messages` (`delivery_key`);
--> statement-breakpoint
CREATE INDEX `patient_activation_messages_client_status_idx` ON `patient_activation_messages` (`client_email`,`status`);
