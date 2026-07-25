ALTER TABLE `clients` ADD `approval_email_status` text DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `approval_email_sent_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `approval_email_error` text;