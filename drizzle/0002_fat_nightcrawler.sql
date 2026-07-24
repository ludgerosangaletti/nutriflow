ALTER TABLE `clients` ADD `auth_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `clients_auth_user_id_unique` ON `clients` (`auth_user_id`);