CREATE TABLE `nf_audit_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`actor_auth_user_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_public_id` text NOT NULL,
	`correlation_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_audit_entries_public_id_unique` ON `nf_audit_entries` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_audit_entries_entity_idx` ON `nf_audit_entries` (`organization_id`,`entity_type`,`entity_public_id`);--> statement-breakpoint
CREATE INDEX `nf_audit_entries_correlation_idx` ON `nf_audit_entries` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `nf_audit_entries_occurred_idx` ON `nf_audit_entries` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `nf_event_consumptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`consumer_name` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`processed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_event_consumptions_event_consumer_unique` ON `nf_event_consumptions` (`event_id`,`consumer_name`);--> statement-breakpoint
CREATE INDEX `nf_event_consumptions_status_idx` ON `nf_event_consumptions` (`status`);--> statement-breakpoint
CREATE TABLE `nf_feature_flag_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`flag_key` text NOT NULL,
	`organization_id` integer,
	`client_id` integer,
	`enabled` integer NOT NULL,
	`variant` text,
	`reason` text NOT NULL,
	`expires_at` text,
	`created_by_auth_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_feature_flag_overrides_public_id_unique` ON `nf_feature_flag_overrides` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_feature_flag_overrides_lookup_idx` ON `nf_feature_flag_overrides` (`flag_key`,`organization_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `nf_organization_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`auth_user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_organization_members_public_id_unique` ON `nf_organization_members` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_organization_members_org_auth_unique` ON `nf_organization_members` (`organization_id`,`auth_user_id`);--> statement-breakpoint
CREATE INDEX `nf_organization_members_auth_idx` ON `nf_organization_members` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `nf_organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_organizations_public_id_unique` ON `nf_organizations` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_organizations_status_idx` ON `nf_organizations` (`status`);--> statement-breakpoint
CREATE TABLE `nf_outbox_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_version` integer NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_public_id` text NOT NULL,
	`aggregate_version` integer NOT NULL,
	`actor_auth_user_id` text NOT NULL,
	`correlation_id` text NOT NULL,
	`causation_id` text,
	`occurred_at` text NOT NULL,
	`payload_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`processed_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_outbox_events_event_id_unique` ON `nf_outbox_events` (`event_id`);--> statement-breakpoint
CREATE INDEX `nf_outbox_events_dispatch_idx` ON `nf_outbox_events` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `nf_outbox_events_aggregate_idx` ON `nf_outbox_events` (`aggregate_type`,`aggregate_public_id`,`aggregate_version`);--> statement-breakpoint
CREATE INDEX `nf_outbox_events_correlation_idx` ON `nf_outbox_events` (`correlation_id`);--> statement-breakpoint
CREATE TABLE `nf_plan_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`plan_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`snapshot_json` text,
	`content_hash` text,
	`created_by_auth_user_id` text NOT NULL,
	`published_by_auth_user_id` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `nf_plans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plan_versions_public_id_unique` ON `nf_plan_versions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plan_versions_plan_number_unique` ON `nf_plan_versions` (`plan_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `nf_plan_versions_plan_state_idx` ON `nf_plan_versions` (`plan_id`,`state`);--> statement-breakpoint
CREATE TABLE `nf_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_auth_user_id` text NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plans_public_id_unique` ON `nf_plans` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_plans_org_client_idx` ON `nf_plans` (`organization_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `nf_plans_org_status_idx` ON `nf_plans` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `nf_publications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`plan_version_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`published_by_auth_user_id` text NOT NULL,
	`published_at` text NOT NULL,
	`revoked_by_auth_user_id` text,
	`revoked_at` text,
	`revocation_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plan_id`) REFERENCES `nf_plans`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plan_version_id`) REFERENCES `nf_plan_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_publications_public_id_unique` ON `nf_publications` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_publications_org_client_status_idx` ON `nf_publications` (`organization_id`,`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `nf_publications_plan_version_idx` ON `nf_publications` (`plan_version_id`);
--> statement-breakpoint
CREATE TRIGGER `nf_plan_versions_published_update_guard`
BEFORE UPDATE ON `nf_plan_versions`
WHEN OLD.`state` = 'published'
BEGIN
	SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_plan_versions_published_delete_guard`
BEFORE DELETE ON `nf_plan_versions`
WHEN OLD.`state` = 'published'
BEGIN
	SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_publications_delete_guard`
BEFORE DELETE ON `nf_publications`
BEGIN
	SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_audit_entries_update_guard`
BEFORE UPDATE ON `nf_audit_entries`
BEGIN
	SELECT RAISE(ABORT, 'NF_AUDIT_APPEND_ONLY');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_audit_entries_delete_guard`
BEFORE DELETE ON `nf_audit_entries`
BEGIN
	SELECT RAISE(ABORT, 'NF_AUDIT_APPEND_ONLY');
END;
