CREATE TABLE `patient_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`original_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text DEFAULT 'application/pdf' NOT NULL,
	`size_bytes` integer NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_documents_object_key_unique` ON `patient_documents` (`object_key`);