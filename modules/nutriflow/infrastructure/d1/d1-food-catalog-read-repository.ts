import { NUTRIFLOW_API_VERSION } from "../../contracts/v1/errors.ts";
import type { FoodCatalogItemV1, FoodCatalogSearchResultV1 } from "../../contracts/v1/catalog.ts";
import type { FoodCatalogReadRepository } from "../../application/ports/food-catalog-repository.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type FoodRow = Readonly<{ public_id: string; revision_public_id: string; revision_number: number; name: string; category_code: string | null; aliases_json: string; reference_quantity_milli: number; unit_public_id: string; unit_code: string; unit_label: string; scope: "global" | "organization"; source: string; energy_kcal: number | null; protein: number | null; carbohydrate: number | null; lipids: number | null }>;

function escapeLike(value: string) { return value.replace(/[\\%_]/g, (character) => `\\${character}`); }
function parseAliases(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string")) : Object.freeze([]);
  } catch { return Object.freeze([]); }
}

export class D1FoodCatalogReadRepository implements FoodCatalogReadRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) { this.database = database; }

  async search(input: Parameters<FoodCatalogReadRepository["search"]>[0]): Promise<FoodCatalogSearchResultV1> {
    const query = input.query.query.trim().toLocaleLowerCase("pt-BR");
    const escapedQuery = escapeLike(query);
    const category = input.query.categoryCode;
    const requestedLimit = input.query.limit;
    const result = await this.database.prepare(
      `SELECT food.public_id, revision.public_id AS revision_public_id, revision.revision_number,
              revision.name, revision.category_code, revision.aliases_json,
              COALESCE(revision.reference_quantity_milli, 100000) AS reference_quantity_milli,
              unit.public_id AS unit_public_id, unit.code AS unit_code, unit.label AS unit_label,
              food.scope, food.source,
              energy_row.amount_scaled / 1000.0 AS energy_kcal,
              protein_row.amount_scaled / 1000.0 AS protein,
              carbohydrate_row.amount_scaled / 1000.0 AS carbohydrate,
              lipids_row.amount_scaled / 1000.0 AS lipids
       FROM nf_foods AS food
       INNER JOIN nf_food_revisions AS revision ON revision.food_id = food.id
       INNER JOIN nf_units AS unit ON unit.id = revision.reference_unit_id AND unit.status = 'active'
       LEFT JOIN nf_food_nutrients AS energy_row ON energy_row.food_revision_id = revision.id AND energy_row.nutrient_id = (SELECT id FROM nf_nutrients WHERE code = 'energy_kcal')
       LEFT JOIN nf_food_nutrients AS protein_row ON protein_row.food_revision_id = revision.id AND protein_row.nutrient_id = (SELECT id FROM nf_nutrients WHERE code = 'protein')
       LEFT JOIN nf_food_nutrients AS carbohydrate_row ON carbohydrate_row.food_revision_id = revision.id AND carbohydrate_row.nutrient_id = (SELECT id FROM nf_nutrients WHERE code = 'carbohydrate')
       LEFT JOIN nf_food_nutrients AS lipids_row ON lipids_row.food_revision_id = revision.id AND lipids_row.nutrient_id = (SELECT id FROM nf_nutrients WHERE code = 'lipids')
       WHERE food.status = 'active'
         AND revision.state = 'released'
         AND (food.scope = 'global' OR (food.scope = 'organization' AND food.organization_id = ?))
         AND revision.revision_number = (SELECT MAX(latest.revision_number) FROM nf_food_revisions AS latest WHERE latest.food_id = food.id AND latest.state = 'released')
         AND (? = '' OR lower(revision.name) LIKE ? ESCAPE '\\' OR lower(revision.aliases_json) LIKE ? ESCAPE '\\')
         AND (? IS NULL OR revision.category_code = ?)
       ORDER BY CASE WHEN lower(revision.name) = ? THEN 0 WHEN lower(revision.name) LIKE ? ESCAPE '\\' THEN 1 WHEN lower(revision.aliases_json) LIKE ? ESCAPE '\\' THEN 2 ELSE 3 END,
                CASE WHEN food.scope = 'organization' THEN 0 WHEN food.source = 'taco' THEN 1 ELSE 2 END,
                revision.name COLLATE NOCASE, revision.revision_number DESC
       LIMIT ?`,
    ).bind(input.organizationId, query, `%${escapedQuery}%`, `%${escapedQuery}%`, category, category, query, `${escapedQuery}%`, `%${escapedQuery}%`, requestedLimit + 1).all<FoodRow>();

    const items: readonly FoodCatalogItemV1[] = Object.freeze(result.results.slice(0, requestedLimit).map((row) => Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      publicId: row.public_id,
      revisionPublicId: row.revision_public_id,
      revisionNumber: row.revision_number,
      name: row.name,
      categoryCode: row.category_code,
      aliases: parseAliases(row.aliases_json),
      referenceQuantityMilli: row.reference_quantity_milli,
      referenceUnit: Object.freeze({ publicId: row.unit_public_id, code: row.unit_code, label: row.unit_label }),
      scope: row.scope,
      source: row.source,
      nutrients: Object.freeze({ energyKcal: row.energy_kcal, protein: row.protein, carbohydrate: row.carbohydrate, fat: row.lipids }),
    })));
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, query: input.query.query, items, hasMore: result.results.length > requestedLimit });
  }
}
