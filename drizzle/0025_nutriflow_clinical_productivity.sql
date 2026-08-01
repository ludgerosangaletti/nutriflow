-- NutriFlow Sprint 4: índices aditivos para busca e conteúdo reutilizável.
CREATE INDEX IF NOT EXISTS `nf_food_revisions_catalog_lookup_idx`
ON `nf_food_revisions` (`state`, `category_code`, lower(`name`), `revision_number` DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `nf_meal_template_versions_latest_idx`
ON `nf_meal_template_versions` (`meal_template_id`, `version_number` DESC, `state`);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `nf_recipe_versions_latest_idx`
ON `nf_recipe_versions` (`recipe_id`, `version_number` DESC, `state`);
