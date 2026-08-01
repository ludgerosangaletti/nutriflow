INSERT OR IGNORE INTO `nf_units` (`public_id`, `organization_id`, `code`, `label`, `dimension`, `factor_numerator`, `factor_denominator`, `status`) VALUES
  ('unit_as_desired', NULL, 'as_desired', 'à vontade', 'count', 1, 1, 'active');
--> statement-breakpoint
WITH `catalog` (`public_id`, `external_code`) AS (VALUES
  ('food_global_filtered_coffee', 'nf-global-filtered-coffee'),
  ('food_global_espresso', 'nf-global-espresso'),
  ('food_global_capsule_coffee', 'nf-global-capsule-coffee'),
  ('food_global_fruit_juice', 'nf-global-fruit-juice'),
  ('food_global_zero_soda', 'nf-global-zero-soda'),
  ('food_global_regular_soda', 'nf-global-regular-soda'),
  ('food_global_tea', 'nf-global-tea')
)
INSERT OR IGNORE INTO `nf_foods` (`public_id`, `organization_id`, `scope`, `source`, `external_code`, `status`, `created_by_auth_user_id`)
SELECT `public_id`, NULL, 'global', 'nutriflow', `external_code`, 'active', 'system:nutriflow' FROM `catalog`;
--> statement-breakpoint
WITH `catalog` (`food_public_id`, `revision_public_id`, `name`, `aliases_json`, `quantity_milli`) AS (VALUES
  ('food_global_filtered_coffee', 'foodrev_global_filtered_coffee_1', 'Café coado sem açúcar', '["cafe coado","café passado","cafe passado"]', 150000),
  ('food_global_espresso', 'foodrev_global_espresso_1', 'Café espresso sem açúcar', '["cafe espresso","expresso","café expresso"]', 50000),
  ('food_global_capsule_coffee', 'foodrev_global_capsule_coffee_1', 'Café em cápsula sem açúcar', '["cafe capsula","café cápsula","cafe em capsula"]', 50000),
  ('food_global_fruit_juice', 'foodrev_global_fruit_juice_1', 'Suco de fruta natural', '["suco natural","suco de frutas","suco"]', 200000),
  ('food_global_zero_soda', 'foodrev_global_zero_soda_1', 'Refrigerante zero', '["refrigerante diet","refri zero","soda zero"]', 200000),
  ('food_global_regular_soda', 'foodrev_global_regular_soda_1', 'Refrigerante comum', '["refrigerante normal","refri comum","soda comum"]', 200000),
  ('food_global_tea', 'foodrev_global_tea_1', 'Chá sem açúcar', '["cha","chá natural","infusão"]', 200000)
)
INSERT OR IGNORE INTO `nf_food_revisions` (`public_id`, `food_id`, `revision_number`, `state`, `name`, `category_code`, `aliases_json`, `reference_quantity_milli`, `reference_unit_id`, `source_metadata_json`, `created_by_auth_user_id`, `released_by_auth_user_id`, `released_at`)
SELECT `catalog`.`revision_public_id`, `food`.`id`, 1, 'released', `catalog`.`name`, 'beverages', `catalog`.`aliases_json`, `catalog`.`quantity_milli`, `unit`.`id`, '{"origin":"nutriflow-curated-starter","nutrients":"pending"}', 'system:nutriflow', 'system:nutriflow', '2026-08-01T00:00:00.000Z'
FROM `catalog`
INNER JOIN `nf_foods` AS `food` ON `food`.`public_id` = `catalog`.`food_public_id`
INNER JOIN `nf_units` AS `unit` ON `unit`.`public_id` = 'unit_milliliter';
