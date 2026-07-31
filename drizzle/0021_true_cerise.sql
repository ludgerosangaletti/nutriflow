CREATE TABLE `nf_delivery_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`primary_source` text DEFAULT 'pdf' NOT NULL,
	`allow_pdf_fallback` integer DEFAULT true NOT NULL,
	`updated_by_auth_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_delivery_settings_public_id_unique` ON `nf_delivery_settings` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_delivery_settings_org_client_unique` ON `nf_delivery_settings` (`organization_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `nf_food_nutrients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`food_revision_id` integer NOT NULL,
	`nutrient_id` integer NOT NULL,
	`amount_scaled` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`food_revision_id`) REFERENCES `nf_food_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`nutrient_id`) REFERENCES `nf_nutrients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_food_nutrients_revision_nutrient_unique` ON `nf_food_nutrients` (`food_revision_id`,`nutrient_id`);--> statement-breakpoint
CREATE INDEX `nf_food_nutrients_nutrient_idx` ON `nf_food_nutrients` (`nutrient_id`);--> statement-breakpoint
CREATE TABLE `nf_food_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`food_id` integer NOT NULL,
	`revision_number` integer NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`name` text NOT NULL,
	`category_code` text,
	`aliases_json` text DEFAULT '[]' NOT NULL,
	`reference_quantity_milli` integer,
	`reference_unit_id` integer,
	`source_metadata_json` text DEFAULT '{}' NOT NULL,
	`created_by_auth_user_id` text NOT NULL,
	`released_by_auth_user_id` text,
	`released_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `nf_foods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reference_unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_food_revisions_public_id_unique` ON `nf_food_revisions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_food_revisions_food_number_unique` ON `nf_food_revisions` (`food_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `nf_food_revisions_food_state_idx` ON `nf_food_revisions` (`food_id`,`state`);--> statement-breakpoint
CREATE INDEX `nf_food_revisions_name_idx` ON `nf_food_revisions` (`name`);--> statement-breakpoint
CREATE TABLE `nf_foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer,
	`scope` text DEFAULT 'organization' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_code` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_auth_user_id` text NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_foods_public_id_unique` ON `nf_foods` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_foods_scope_status_idx` ON `nf_foods` (`scope`,`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `nf_foods_external_code_idx` ON `nf_foods` (`source`,`external_code`);--> statement-breakpoint
CREATE TABLE `nf_meal_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`meal_id` integer NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_public_id` text,
	`source_revision_number` integer,
	`display_name_snapshot` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`unit_code_snapshot` text NOT NULL,
	`unit_label_snapshot` text NOT NULL,
	`preparation` text,
	`notes` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `nf_meals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_items_public_id_unique` ON `nf_meal_items` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_items_meal_order_unique` ON `nf_meal_items` (`meal_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `nf_meal_items_source_idx` ON `nf_meal_items` (`source_type`,`source_public_id`,`source_revision_number`);--> statement-breakpoint
CREATE TABLE `nf_meal_template_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`meal_template_version_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_public_id` text,
	`source_revision_number` integer,
	`display_name_snapshot` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`unit_code_snapshot` text NOT NULL,
	`preparation` text,
	`notes` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meal_template_version_id`) REFERENCES `nf_meal_template_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_template_items_public_id_unique` ON `nf_meal_template_items` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_template_items_version_order_unique` ON `nf_meal_template_items` (`meal_template_version_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_meal_template_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`meal_template_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`name` text NOT NULL,
	`suggested_time` text,
	`instructions` text,
	`snapshot_json` text,
	`content_hash` text,
	`created_by_auth_user_id` text NOT NULL,
	`released_by_auth_user_id` text,
	`released_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meal_template_id`) REFERENCES `nf_meal_templates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_template_versions_public_id_unique` ON `nf_meal_template_versions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_template_versions_template_number_unique` ON `nf_meal_template_versions` (`meal_template_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `nf_meal_template_versions_state_idx` ON `nf_meal_template_versions` (`meal_template_id`,`state`);--> statement-breakpoint
CREATE TABLE `nf_meal_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer,
	`scope` text DEFAULT 'organization' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_auth_user_id` text NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meal_templates_public_id_unique` ON `nf_meal_templates` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_meal_templates_scope_status_idx` ON `nf_meal_templates` (`scope`,`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `nf_meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`plan_version_id` integer NOT NULL,
	`plan_day_id` integer,
	`title` text NOT NULL,
	`scheduled_time` text,
	`instructions` text,
	`source_template_public_id` text,
	`source_template_version_number` integer,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `nf_plan_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plan_day_id`) REFERENCES `nf_plan_days`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_meals_public_id_unique` ON `nf_meals` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_meals_version_order_idx` ON `nf_meals` (`plan_version_id`,`plan_day_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_nutrients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`unit_code` text NOT NULL,
	`amount_scale` integer DEFAULT 1000 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_nutrients_public_id_unique` ON `nf_nutrients` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_nutrients_code_unique` ON `nf_nutrients` (`code`);--> statement-breakpoint
CREATE TABLE `nf_plan_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`plan_version_id` integer NOT NULL,
	`label` text NOT NULL,
	`day_index` integer,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `nf_plan_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plan_days_public_id_unique` ON `nf_plan_days` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plan_days_version_order_unique` ON `nf_plan_days` (`plan_version_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_plan_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`plan_version_id` integer NOT NULL,
	`meal_id` integer,
	`kind` text DEFAULT 'general' NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `nf_plan_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`meal_id`) REFERENCES `nf_meals`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_plan_notes_public_id_unique` ON `nf_plan_notes` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_plan_notes_version_order_idx` ON `nf_plan_notes` (`plan_version_id`,`meal_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_recipe_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`recipe_version_id` integer NOT NULL,
	`food_revision_id` integer NOT NULL,
	`display_name_snapshot` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`unit_code_snapshot` text NOT NULL,
	`preparation` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recipe_version_id`) REFERENCES `nf_recipe_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`food_revision_id`) REFERENCES `nf_food_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_recipe_items_public_id_unique` ON `nf_recipe_items` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_recipe_items_version_order_unique` ON `nf_recipe_items` (`recipe_version_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_recipe_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`recipe_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`name` text NOT NULL,
	`instructions` text,
	`yield_quantity_milli` integer NOT NULL,
	`yield_unit_id` integer NOT NULL,
	`snapshot_json` text,
	`content_hash` text,
	`created_by_auth_user_id` text NOT NULL,
	`released_by_auth_user_id` text,
	`released_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `nf_recipes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`yield_unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_recipe_versions_public_id_unique` ON `nf_recipe_versions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_recipe_versions_recipe_number_unique` ON `nf_recipe_versions` (`recipe_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `nf_recipe_versions_recipe_state_idx` ON `nf_recipe_versions` (`recipe_id`,`state`);--> statement-breakpoint
CREATE TABLE `nf_recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer,
	`scope` text DEFAULT 'organization' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_auth_user_id` text NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_recipes_public_id_unique` ON `nf_recipes` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_recipes_scope_status_idx` ON `nf_recipes` (`scope`,`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `nf_substitution_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`plan_version_id` integer NOT NULL,
	`meal_id` integer,
	`meal_item_id` integer,
	`title` text NOT NULL,
	`rule_code` text DEFAULT 'choose_one' NOT NULL,
	`notes` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `nf_plan_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`meal_id`) REFERENCES `nf_meals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`meal_item_id`) REFERENCES `nf_meal_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_substitution_groups_public_id_unique` ON `nf_substitution_groups` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_substitution_groups_version_order_idx` ON `nf_substitution_groups` (`plan_version_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_substitution_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`substitution_group_id` integer NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_public_id` text,
	`source_revision_number` integer,
	`display_name_snapshot` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`unit_code_snapshot` text NOT NULL,
	`unit_label_snapshot` text NOT NULL,
	`notes` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`substitution_group_id`) REFERENCES `nf_substitution_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `nf_units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_substitution_options_public_id_unique` ON `nf_substitution_options` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nf_substitution_options_group_order_unique` ON `nf_substitution_options` (`substitution_group_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `nf_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` integer,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`dimension` text NOT NULL,
	`factor_numerator` integer DEFAULT 1 NOT NULL,
	`factor_denominator` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `nf_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_units_public_id_unique` ON `nf_units` (`public_id`);--> statement-breakpoint
CREATE INDEX `nf_units_scope_code_idx` ON `nf_units` (`organization_id`,`code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `nf_publications_one_active_plan_unique`
ON `nf_publications` (`organization_id`, `client_id`, `plan_id`)
WHERE `status` = 'active';
--> statement-breakpoint
CREATE TRIGGER `nf_food_revisions_released_update_guard`
BEFORE UPDATE ON `nf_food_revisions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_food_revisions_released_delete_guard`
BEFORE DELETE ON `nf_food_revisions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_recipe_versions_released_update_guard`
BEFORE UPDATE ON `nf_recipe_versions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_VERSION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_recipe_versions_released_delete_guard`
BEFORE DELETE ON `nf_recipe_versions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_VERSION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_meal_template_versions_released_update_guard`
BEFORE UPDATE ON `nf_meal_template_versions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_VERSION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `nf_meal_template_versions_released_delete_guard`
BEFORE DELETE ON `nf_meal_template_versions`
WHEN OLD.`state` = 'released'
BEGIN
	SELECT RAISE(ABORT, 'NF_RELEASED_VERSION_IMMUTABLE');
END;
