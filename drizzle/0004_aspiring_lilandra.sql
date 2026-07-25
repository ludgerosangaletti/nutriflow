CREATE TABLE `progress_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`period` text NOT NULL,
	`angle` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_photos_period_angle_unique` ON `progress_photos` (`client_email`,`period`,`angle`);