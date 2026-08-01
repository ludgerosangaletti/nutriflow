ALTER TABLE `clients` ADD `archived_at` text;
--> statement-breakpoint
ALTER TABLE `clients` ADD `archive_reason` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `clients_active_created_idx`
ON `clients` (`archived_at`, `created_at` DESC);
