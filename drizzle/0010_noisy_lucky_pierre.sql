CREATE TABLE `goal_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`client_email` text NOT NULL,
	`value` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'patient' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_email` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`initial_value` text NOT NULL,
	`target_value` text NOT NULL,
	`current_value` text NOT NULL,
	`unit` text NOT NULL,
	`deadline` text,
	`frequency` text DEFAULT 'weekly' NOT NULL,
	`professional_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`achieved_at` text
);
