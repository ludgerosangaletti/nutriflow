CREATE INDEX IF NOT EXISTS `nf_food_revisions_name_nocase_idx`
ON `nf_food_revisions` (`name` COLLATE NOCASE);
--> statement-breakpoint
WITH `catalog` (`public_id`, `external_code`) AS (VALUES
  ('food_global_banana', 'nf-global-banana'),
  ('food_global_apple', 'nf-global-apple'),
  ('food_global_papaya', 'nf-global-papaya'),
  ('food_global_orange', 'nf-global-orange'),
  ('food_global_strawberry', 'nf-global-strawberry'),
  ('food_global_avocado', 'nf-global-avocado'),
  ('food_global_white_rice_cooked', 'nf-global-white-rice-cooked'),
  ('food_global_brown_rice_cooked', 'nf-global-brown-rice-cooked'),
  ('food_global_carioca_beans_cooked', 'nf-global-carioca-beans-cooked'),
  ('food_global_oats', 'nf-global-oats'),
  ('food_global_sweet_potato_cooked', 'nf-global-sweet-potato-cooked'),
  ('food_global_whole_bread', 'nf-global-whole-bread'),
  ('food_global_tapioca_gum', 'nf-global-tapioca-gum'),
  ('food_global_pasta_cooked', 'nf-global-pasta-cooked'),
  ('food_global_chicken_breast_grilled', 'nf-global-chicken-breast-grilled'),
  ('food_global_patinho_grilled', 'nf-global-patinho-grilled'),
  ('food_global_ground_beef', 'nf-global-ground-beef'),
  ('food_global_egg_cooked', 'nf-global-egg-cooked'),
  ('food_global_tilapia_grilled', 'nf-global-tilapia-grilled'),
  ('food_global_tuna_water', 'nf-global-tuna-water'),
  ('food_global_skim_milk', 'nf-global-skim-milk'),
  ('food_global_natural_yogurt', 'nf-global-natural-yogurt'),
  ('food_global_minas_cheese', 'nf-global-minas-cheese'),
  ('food_global_whey_concentrate', 'nf-global-whey-concentrate'),
  ('food_global_olive_oil', 'nf-global-olive-oil'),
  ('food_global_peanut_butter', 'nf-global-peanut-butter'),
  ('food_global_broccoli', 'nf-global-broccoli'),
  ('food_global_tomato', 'nf-global-tomato'),
  ('food_global_carrot', 'nf-global-carrot'),
  ('food_global_lettuce', 'nf-global-lettuce')
)
INSERT OR IGNORE INTO `nf_foods` (`public_id`, `organization_id`, `scope`, `source`, `external_code`, `status`, `created_by_auth_user_id`)
SELECT `public_id`, NULL, 'global', 'nutriflow', `external_code`, 'active', 'system:nutriflow' FROM `catalog`;
--> statement-breakpoint
WITH `catalog` (`food_public_id`, `revision_public_id`, `name`, `category_code`, `aliases_json`, `quantity_milli`, `unit_public_id`) AS (VALUES
  ('food_global_banana', 'foodrev_global_banana_1', 'Banana', 'fruits', '["banana prata","banana nanica","banana caturra"]', 100000, 'unit_gram'),
  ('food_global_apple', 'foodrev_global_apple_1', 'Maçã', 'fruits', '["maca","maçã gala","maçã fuji"]', 100000, 'unit_gram'),
  ('food_global_papaya', 'foodrev_global_papaya_1', 'Mamão', 'fruits', '["mamao","mamão papaia","mamão formosa"]', 100000, 'unit_gram'),
  ('food_global_orange', 'foodrev_global_orange_1', 'Laranja', 'fruits', '["laranja pera","laranja bahia"]', 100000, 'unit_gram'),
  ('food_global_strawberry', 'foodrev_global_strawberry_1', 'Morango', 'fruits', '["morangos"]', 100000, 'unit_gram'),
  ('food_global_avocado', 'foodrev_global_avocado_1', 'Abacate', 'fruits', '["avocado"]', 100000, 'unit_gram'),
  ('food_global_white_rice_cooked', 'foodrev_global_white_rice_cooked_1', 'Arroz branco cozido', 'carbohydrates', '["arroz cozido","arroz branco"]', 100000, 'unit_gram'),
  ('food_global_brown_rice_cooked', 'foodrev_global_brown_rice_cooked_1', 'Arroz integral cozido', 'carbohydrates', '["arroz integral"]', 100000, 'unit_gram'),
  ('food_global_carioca_beans_cooked', 'foodrev_global_carioca_beans_cooked_1', 'Feijão carioca cozido', 'legumes', '["feijao","feijão cozido","feijão carioca"]', 100000, 'unit_gram'),
  ('food_global_oats', 'foodrev_global_oats_1', 'Aveia em flocos', 'carbohydrates', '["aveia","flocos de aveia"]', 100000, 'unit_gram'),
  ('food_global_sweet_potato_cooked', 'foodrev_global_sweet_potato_cooked_1', 'Batata-doce cozida', 'carbohydrates', '["batata doce","batata-doce"]', 100000, 'unit_gram'),
  ('food_global_whole_bread', 'foodrev_global_whole_bread_1', 'Pão integral', 'carbohydrates', '["pao integral","pão de forma integral"]', 1000, 'unit_slice'),
  ('food_global_tapioca_gum', 'foodrev_global_tapioca_gum_1', 'Goma de tapioca', 'carbohydrates', '["tapioca","goma para tapioca"]', 50000, 'unit_gram'),
  ('food_global_pasta_cooked', 'foodrev_global_pasta_cooked_1', 'Macarrão cozido', 'carbohydrates', '["macarrao","massa cozida"]', 100000, 'unit_gram'),
  ('food_global_chicken_breast_grilled', 'foodrev_global_chicken_breast_grilled_1', 'Peito de frango grelhado', 'proteins', '["frango grelhado","peito de frango"]', 100000, 'unit_gram'),
  ('food_global_patinho_grilled', 'foodrev_global_patinho_grilled_1', 'Patinho bovino grelhado', 'proteins', '["patinho grelhado","carne bovina magra"]', 100000, 'unit_gram'),
  ('food_global_ground_beef', 'foodrev_global_ground_beef_1', 'Carne moída magra', 'proteins', '["carne moida","patinho moído"]', 100000, 'unit_gram'),
  ('food_global_egg_cooked', 'foodrev_global_egg_cooked_1', 'Ovo cozido', 'proteins', '["ovo","ovo de galinha"]', 1000, 'unit_piece'),
  ('food_global_tilapia_grilled', 'foodrev_global_tilapia_grilled_1', 'Tilápia grelhada', 'proteins', '["tilapia","filé de tilápia"]', 100000, 'unit_gram'),
  ('food_global_tuna_water', 'foodrev_global_tuna_water_1', 'Atum em água', 'proteins', '["atum","atum enlatado"]', 100000, 'unit_gram'),
  ('food_global_skim_milk', 'foodrev_global_skim_milk_1', 'Leite desnatado', 'dairy', '["leite zero gordura"]', 200000, 'unit_milliliter'),
  ('food_global_natural_yogurt', 'foodrev_global_natural_yogurt_1', 'Iogurte natural', 'dairy', '["iogurte sem açúcar","iogurte integral natural"]', 170000, 'unit_gram'),
  ('food_global_minas_cheese', 'foodrev_global_minas_cheese_1', 'Queijo minas frescal', 'dairy', '["queijo minas","minas frescal"]', 30000, 'unit_gram'),
  ('food_global_whey_concentrate', 'foodrev_global_whey_concentrate_1', 'Whey protein concentrado', 'supplements', '["whey","proteína do soro do leite"]', 30000, 'unit_gram'),
  ('food_global_olive_oil', 'foodrev_global_olive_oil_1', 'Azeite de oliva', 'fats', '["azeite","azeite extravirgem"]', 10000, 'unit_milliliter'),
  ('food_global_peanut_butter', 'foodrev_global_peanut_butter_1', 'Pasta de amendoim', 'fats', '["manteiga de amendoim","pasta integral de amendoim"]', 15000, 'unit_gram'),
  ('food_global_broccoli', 'foodrev_global_broccoli_1', 'Brócolis cozido', 'vegetables', '["brocolis","brócolis"]', 100000, 'unit_gram'),
  ('food_global_tomato', 'foodrev_global_tomato_1', 'Tomate', 'vegetables', '["tomate cru"]', 100000, 'unit_gram'),
  ('food_global_carrot', 'foodrev_global_carrot_1', 'Cenoura cozida', 'vegetables', '["cenoura"]', 100000, 'unit_gram'),
  ('food_global_lettuce', 'foodrev_global_lettuce_1', 'Alface', 'vegetables', '["alface crespa","alface americana"]', 100000, 'unit_gram')
)
INSERT OR IGNORE INTO `nf_food_revisions` (`public_id`, `food_id`, `revision_number`, `state`, `name`, `category_code`, `aliases_json`, `reference_quantity_milli`, `reference_unit_id`, `source_metadata_json`, `created_by_auth_user_id`, `released_by_auth_user_id`, `released_at`)
SELECT `catalog`.`revision_public_id`, `food`.`id`, 1, 'released', `catalog`.`name`, `catalog`.`category_code`, `catalog`.`aliases_json`, `catalog`.`quantity_milli`, `unit`.`id`, '{"origin":"nutriflow-curated-starter","nutrients":"pending"}', 'system:nutriflow', 'system:nutriflow', '2026-08-01T00:00:00.000Z'
FROM `catalog`
INNER JOIN `nf_foods` AS `food` ON `food`.`public_id` = `catalog`.`food_public_id`
INNER JOIN `nf_units` AS `unit` ON `unit`.`public_id` = `catalog`.`unit_public_id`;

