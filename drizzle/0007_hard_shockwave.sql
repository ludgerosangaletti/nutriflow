ALTER TABLE `clients` ADD `purchase_started_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `purchase_alert_status` text DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `purchase_alert_sent_at` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `purchase_alert_error` text;