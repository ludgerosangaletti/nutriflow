import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type {
  MealTemplateVersionV1,
  RecipeVersionV1,
  ReusableContentItemV1,
  ReusableContentSearchResultV1,
} from "../../contracts/v1/reusable-content.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { ReusableContentRepository, ReusableContentWriteContext } from "../../application/ports/reusable-content-repository.ts";
import { reusableContentEvent } from "../../domain/reusable-content/reusable-content-events.ts";
import { serializeDomainEventForOutbox } from "../outbox/serialize-domain-event.ts";
import type { D1OperationDatabaseLike, D1OperationStatementLike } from "./d1-operation-database.ts";

type D1ReusableDatabaseLike = D1OperationDatabaseLike & Readonly<{
  batch(statements: D1OperationStatementLike[]): Promise<unknown[]>;
}>;

type TemplateRow = Readonly<{
  aggregate_public_id: string; version_public_id: string; version_number: number; state: string; name: string; suggested_time: string | null; instructions: string | null; created_at: string;
  item_public_id: string | null; source_type: string | null; source_public_id: string | null; source_revision_number: number | null; display_name_snapshot: string | null; quantity_milli: number | null; unit_public_id: string | null; unit_code: string | null; unit_label: string | null; preparation: string | null; notes: string | null; sort_order: number | null;
}>;
type RecipeRow = Readonly<{
  aggregate_public_id: string; version_public_id: string; version_number: number; state: string; name: string; instructions: string | null; yield_quantity_milli: number; yield_unit_public_id: string; yield_unit_code: string; yield_unit_label: string; created_at: string;
  item_public_id: string | null; food_public_id: string | null; food_revision_number: number | null; display_name_snapshot: string | null; quantity_milli: number | null; unit_public_id: string | null; unit_code: string | null; unit_label: string | null; preparation: string | null; sort_order: number | null;
}>;

function escapeLike(value: string) { return value.replace(/[\\%_]/g, (character) => `\\${character}`); }
function state(value: string): "draft" | "released" | "superseded" { return value === "released" || value === "superseded" ? value : "draft"; }
function unit(publicId: string, code: string, label: string) { return Object.freeze({ publicId, code, label }); }

async function hashJson(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function groupTemplates(rows: readonly TemplateRow[], query: string, limit: number): ReusableContentSearchResultV1<MealTemplateVersionV1> {
  const grouped = new Map<string, MealTemplateVersionV1 & { items: ReusableContentItemV1[] }>();
  for (const row of rows) {
    let current = grouped.get(row.version_public_id);
    if (!current) {
      current = { apiVersion: NUTRIFLOW_API_VERSION, templatePublicId: row.aggregate_public_id, versionPublicId: row.version_public_id, versionNumber: row.version_number, state: state(row.state), name: row.name, suggestedTime: row.suggested_time, instructions: row.instructions, items: [], createdAt: row.created_at };
      grouped.set(row.version_public_id, current);
    }
    if (row.item_public_id && row.display_name_snapshot && row.quantity_milli && row.unit_public_id && row.unit_code && row.unit_label && row.sort_order !== null) {
      current.items.push(Object.freeze({ publicId: row.item_public_id, source: Object.freeze({ type: row.source_type === "food" || row.source_type === "recipe" ? row.source_type : "manual", publicId: row.source_public_id, revisionNumber: row.source_revision_number }), displayName: row.display_name_snapshot, quantityMilli: row.quantity_milli, unit: unit(row.unit_public_id, row.unit_code, row.unit_label), preparation: row.preparation, notes: row.notes, sortOrder: row.sort_order }));
    }
  }
  const values = [...grouped.values()];
  return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, query, items: Object.freeze(values.slice(0, limit).map((entry) => Object.freeze({ ...entry, items: Object.freeze(entry.items) }))), hasMore: values.length > limit });
}

function groupRecipes(rows: readonly RecipeRow[], query: string, limit: number): ReusableContentSearchResultV1<RecipeVersionV1> {
  const grouped = new Map<string, RecipeVersionV1 & { ingredients: ReusableContentItemV1[] }>();
  for (const row of rows) {
    let current = grouped.get(row.version_public_id);
    if (!current) {
      current = { apiVersion: NUTRIFLOW_API_VERSION, recipePublicId: row.aggregate_public_id, versionPublicId: row.version_public_id, versionNumber: row.version_number, state: state(row.state), name: row.name, instructions: row.instructions, yieldQuantityMilli: row.yield_quantity_milli, yieldUnit: unit(row.yield_unit_public_id, row.yield_unit_code, row.yield_unit_label), ingredients: [], createdAt: row.created_at };
      grouped.set(row.version_public_id, current);
    }
    if (row.item_public_id && row.display_name_snapshot && row.quantity_milli && row.unit_public_id && row.unit_code && row.unit_label && row.sort_order !== null) {
      current.ingredients.push(Object.freeze({ publicId: row.item_public_id, source: Object.freeze({ type: "food", publicId: row.food_public_id, revisionNumber: row.food_revision_number }), displayName: row.display_name_snapshot, quantityMilli: row.quantity_milli, unit: unit(row.unit_public_id, row.unit_code, row.unit_label), preparation: row.preparation, notes: null, sortOrder: row.sort_order }));
    }
  }
  const values = [...grouped.values()];
  return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, query, items: Object.freeze(values.slice(0, limit).map((entry) => Object.freeze({ ...entry, ingredients: Object.freeze(entry.ingredients) }))), hasMore: values.length > limit });
}

export class D1ReusableContentRepository implements ReusableContentRepository {
  private readonly database: D1ReusableDatabaseLike;
  constructor(database: D1ReusableDatabaseLike) { this.database = database; }

  async searchMealTemplates(input: Parameters<ReusableContentRepository["searchMealTemplates"]>[0]) {
    const query = input.query.query.trim().toLocaleLowerCase("pt-BR");
    const like = `%${escapeLike(query)}%`;
    const result = await this.database.prepare(`WITH selected AS (
      SELECT template.id AS aggregate_id, template.public_id AS aggregate_public_id, version.id AS version_id, version.public_id AS version_public_id, version.version_number, version.state, version.name, version.suggested_time, version.instructions, version.created_at
      FROM nf_meal_templates AS template INNER JOIN nf_meal_template_versions AS version ON version.meal_template_id = template.id
      WHERE template.status = 'active' AND (template.scope = 'global' OR (template.scope = 'organization' AND template.organization_id = ?))
        AND version.version_number = (SELECT MAX(latest.version_number) FROM nf_meal_template_versions AS latest WHERE latest.meal_template_id = template.id)
        AND (? = '' OR lower(version.name) LIKE ? ESCAPE '\\')
      ORDER BY version.created_at DESC, version.name COLLATE NOCASE LIMIT ?
    ) SELECT selected.*, item.public_id AS item_public_id, item.source_type, item.source_public_id, item.source_revision_number, item.display_name_snapshot, item.quantity_milli, unit.public_id AS unit_public_id, item.unit_code_snapshot AS unit_code, unit.label AS unit_label, item.preparation, item.notes, item.sort_order
      FROM selected LEFT JOIN nf_meal_template_items AS item ON item.meal_template_version_id = selected.version_id LEFT JOIN nf_units AS unit ON unit.id = item.unit_id ORDER BY selected.created_at DESC, item.sort_order`).bind(input.organizationId, query, like, input.query.limit + 1).all<TemplateRow>();
    return groupTemplates(result.results, input.query.query, input.query.limit);
  }

  async saveMealTemplate(input: Parameters<ReusableContentRepository["saveMealTemplate"]>[0]) {
    const { context, command } = input;
    const existing = command.templatePublicId ? await this.database.prepare("SELECT id, public_id FROM nf_meal_templates WHERE public_id = ? AND organization_id = ? AND scope = 'organization' AND status = 'active'").bind(command.templatePublicId, context.organizationId).first<{ id: number; public_id: string }>() : null;
    if (command.templatePublicId && !existing) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Modelo não encontrado.", 404);
    const templatePublicId = existing?.public_id ?? context.generatePublicId("meal_template");
    const aggregateId = existing?.id ?? null;
    const latest = aggregateId ? await this.database.prepare("SELECT COALESCE(MAX(version_number), 0) AS version_number FROM nf_meal_template_versions WHERE meal_template_id = ?").bind(aggregateId).first<{ version_number: number }>() : null;
    const versionNumber = (latest?.version_number ?? 0) + 1;
    const versionPublicId = context.generatePublicId("meal_template_version");
    const versionState = command.release ? "released" : "draft";
    const snapshot = { schemaVersion: 1, name: command.name, suggestedTime: command.suggestedTime, instructions: command.instructions, items: command.items };
    const contentHash = await hashJson(snapshot);
    const event = reusableContentEvent({ eventId: context.generatePublicId("event"), kind: "meal-template", action: "version-created", aggregatePublicId: templatePublicId, aggregateVersion: versionNumber, versionPublicId, state: versionState, occurredAt: context.occurredAt, actor: { authUserId: context.actor.authUserId, role: context.actor.role }, correlationId: context.correlationId, metadata: { organizationPublicId: context.organizationPublicId, environment: context.environment, source: "nutriflow-admin" } });
    const outbox = serializeDomainEventForOutbox(event);
    const statements: D1OperationStatementLike[] = [];
    if (!existing) statements.push(this.database.prepare("INSERT INTO nf_meal_templates (public_id, organization_id, scope, status, created_by_auth_user_id, created_at, updated_at) VALUES (?, ?, 'organization', 'active', ?, ?, ?)").bind(templatePublicId, context.organizationId, context.actor.authUserId, context.occurredAt, context.occurredAt));
    statements.push(this.database.prepare("INSERT INTO nf_meal_template_versions (public_id, meal_template_id, version_number, state, name, suggested_time, instructions, snapshot_json, content_hash, created_by_auth_user_id, released_by_auth_user_id, released_at, created_at) VALUES (?, (SELECT id FROM nf_meal_templates WHERE public_id = ? AND organization_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(versionPublicId, templatePublicId, context.organizationId, versionNumber, versionState, command.name, command.suggestedTime, command.instructions, JSON.stringify(snapshot), contentHash, context.actor.authUserId, command.release ? context.actor.authUserId : null, command.release ? context.occurredAt : null, context.occurredAt));
    command.items.forEach((item, index) => statements.push(this.database.prepare("INSERT INTO nf_meal_template_items (public_id, meal_template_version_id, source_type, source_public_id, source_revision_number, display_name_snapshot, quantity_milli, unit_id, unit_code_snapshot, preparation, notes, sort_order, created_at) VALUES (?, (SELECT id FROM nf_meal_template_versions WHERE public_id = ?), ?, ?, ?, ?, ?, (SELECT id FROM nf_units WHERE public_id = ? AND status = 'active'), ?, ?, ?, ?, ?)").bind(context.generatePublicId("meal_template_item"), versionPublicId, item.source.type, item.source.publicId, item.source.revisionNumber, item.displayName, item.quantityMilli, item.unit.publicId, item.unit.code, item.preparation, item.notes, index, context.occurredAt)));
    statements.push(this.auditStatement(context, command.templatePublicId ? "meal-template.version.created" : "meal-template.created", "meal-template", templatePublicId, null, JSON.stringify({ versionNumber, state: versionState })));
    statements.push(this.outboxStatement(context.organizationId, outbox));
    await this.database.batch(statements);
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, templatePublicId, versionPublicId, versionNumber, state: state(versionState), name: command.name, suggestedTime: command.suggestedTime, instructions: command.instructions, items: command.items, createdAt: context.occurredAt });
  }

  async searchRecipes(input: Parameters<ReusableContentRepository["searchRecipes"]>[0]) {
    const query = input.query.query.trim().toLocaleLowerCase("pt-BR");
    const like = `%${escapeLike(query)}%`;
    const result = await this.database.prepare(`WITH selected AS (
      SELECT recipe.id AS aggregate_id, recipe.public_id AS aggregate_public_id, version.id AS version_id, version.public_id AS version_public_id, version.version_number, version.state, version.name, version.instructions, version.yield_quantity_milli, version.yield_unit_id, version.created_at
      FROM nf_recipes AS recipe INNER JOIN nf_recipe_versions AS version ON version.recipe_id = recipe.id
      WHERE recipe.status = 'active' AND (recipe.scope = 'global' OR (recipe.scope = 'organization' AND recipe.organization_id = ?))
        AND version.version_number = (SELECT MAX(latest.version_number) FROM nf_recipe_versions AS latest WHERE latest.recipe_id = recipe.id)
        AND (? = '' OR lower(version.name) LIKE ? ESCAPE '\\')
      ORDER BY version.created_at DESC, version.name COLLATE NOCASE LIMIT ?
    ) SELECT selected.*, yield_unit.public_id AS yield_unit_public_id, yield_unit.code AS yield_unit_code, yield_unit.label AS yield_unit_label, item.public_id AS item_public_id, food.public_id AS food_public_id, food_revision.revision_number AS food_revision_number, item.display_name_snapshot, item.quantity_milli, ingredient_unit.public_id AS unit_public_id, item.unit_code_snapshot AS unit_code, ingredient_unit.label AS unit_label, item.preparation, item.sort_order
      FROM selected INNER JOIN nf_units AS yield_unit ON yield_unit.id = selected.yield_unit_id LEFT JOIN nf_recipe_items AS item ON item.recipe_version_id = selected.version_id LEFT JOIN nf_food_revisions AS food_revision ON food_revision.id = item.food_revision_id LEFT JOIN nf_foods AS food ON food.id = food_revision.food_id LEFT JOIN nf_units AS ingredient_unit ON ingredient_unit.id = item.unit_id ORDER BY selected.created_at DESC, item.sort_order`).bind(input.organizationId, query, like, input.query.limit + 1).all<RecipeRow>();
    return groupRecipes(result.results, input.query.query, input.query.limit);
  }

  async saveRecipe(input: Parameters<ReusableContentRepository["saveRecipe"]>[0]) {
    const { context, command } = input;
    const existing = command.recipePublicId ? await this.database.prepare("SELECT id, public_id FROM nf_recipes WHERE public_id = ? AND organization_id = ? AND scope = 'organization' AND status = 'active'").bind(command.recipePublicId, context.organizationId).first<{ id: number; public_id: string }>() : null;
    if (command.recipePublicId && !existing) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Receita não encontrada.", 404);
    const recipePublicId = existing?.public_id ?? context.generatePublicId("recipe");
    const latest = existing ? await this.database.prepare("SELECT COALESCE(MAX(version_number), 0) AS version_number FROM nf_recipe_versions WHERE recipe_id = ?").bind(existing.id).first<{ version_number: number }>() : null;
    const versionNumber = (latest?.version_number ?? 0) + 1;
    const versionPublicId = context.generatePublicId("recipe_version");
    const versionState = command.release ? "released" : "draft";
    const snapshot = { schemaVersion: 1, name: command.name, instructions: command.instructions, yieldQuantityMilli: command.yieldQuantityMilli, yieldUnit: command.yieldUnit, ingredients: command.ingredients };
    const contentHash = await hashJson(snapshot);
    const event = reusableContentEvent({ eventId: context.generatePublicId("event"), kind: "recipe", action: "version-created", aggregatePublicId: recipePublicId, aggregateVersion: versionNumber, versionPublicId, state: versionState, occurredAt: context.occurredAt, actor: { authUserId: context.actor.authUserId, role: context.actor.role }, correlationId: context.correlationId, metadata: { organizationPublicId: context.organizationPublicId, environment: context.environment, source: "nutriflow-admin" } });
    const outbox = serializeDomainEventForOutbox(event);
    const statements: D1OperationStatementLike[] = [];
    if (!existing) statements.push(this.database.prepare("INSERT INTO nf_recipes (public_id, organization_id, scope, status, created_by_auth_user_id, created_at, updated_at) VALUES (?, ?, 'organization', 'active', ?, ?, ?)").bind(recipePublicId, context.organizationId, context.actor.authUserId, context.occurredAt, context.occurredAt));
    statements.push(this.database.prepare("INSERT INTO nf_recipe_versions (public_id, recipe_id, version_number, state, name, instructions, yield_quantity_milli, yield_unit_id, snapshot_json, content_hash, created_by_auth_user_id, released_by_auth_user_id, released_at, created_at) VALUES (?, (SELECT id FROM nf_recipes WHERE public_id = ? AND organization_id = ?), ?, ?, ?, ?, ?, (SELECT id FROM nf_units WHERE public_id = ? AND status = 'active'), ?, ?, ?, ?, ?, ?)").bind(versionPublicId, recipePublicId, context.organizationId, versionNumber, versionState, command.name, command.instructions, command.yieldQuantityMilli, command.yieldUnit.publicId, JSON.stringify(snapshot), contentHash, context.actor.authUserId, command.release ? context.actor.authUserId : null, command.release ? context.occurredAt : null, context.occurredAt));
    command.ingredients.forEach((item, index) => statements.push(this.database.prepare("INSERT INTO nf_recipe_items (public_id, recipe_version_id, food_revision_id, display_name_snapshot, quantity_milli, unit_id, unit_code_snapshot, preparation, sort_order, created_at) VALUES (?, (SELECT id FROM nf_recipe_versions WHERE public_id = ?), (SELECT revision.id FROM nf_food_revisions AS revision INNER JOIN nf_foods AS food ON food.id = revision.food_id WHERE food.public_id = ? AND revision.revision_number = ? AND revision.state = 'released' AND (food.scope = 'global' OR food.organization_id = ?)), ?, ?, (SELECT id FROM nf_units WHERE public_id = ? AND status = 'active'), ?, ?, ?, ?)").bind(context.generatePublicId("recipe_item"), versionPublicId, item.source.publicId, item.source.revisionNumber, context.organizationId, item.displayName, item.quantityMilli, item.unit.publicId, item.unit.code, item.preparation, index, context.occurredAt)));
    statements.push(this.auditStatement(context, command.recipePublicId ? "recipe.version.created" : "recipe.created", "recipe", recipePublicId, null, JSON.stringify({ versionNumber, state: versionState })));
    statements.push(this.outboxStatement(context.organizationId, outbox));
    await this.database.batch(statements);
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, recipePublicId, versionPublicId, versionNumber, state: state(versionState), name: command.name, instructions: command.instructions, yieldQuantityMilli: command.yieldQuantityMilli, yieldUnit: command.yieldUnit, ingredients: command.ingredients, createdAt: context.occurredAt });
  }

  archiveMealTemplate(input: Parameters<ReusableContentRepository["archiveMealTemplate"]>[0]) { return this.archive("meal-template", input); }
  archiveRecipe(input: Parameters<ReusableContentRepository["archiveRecipe"]>[0]) { return this.archive("recipe", input); }

  private async archive(kind: "meal-template" | "recipe", input: Parameters<ReusableContentRepository["archiveRecipe"]>[0]) {
    const table = kind === "recipe" ? "nf_recipes" : "nf_meal_templates";
    const versions = kind === "recipe" ? "nf_recipe_versions" : "nf_meal_template_versions";
    const foreign = kind === "recipe" ? "recipe_id" : "meal_template_id";
    const row = await this.database.prepare(`SELECT aggregate.id, COALESCE(MAX(version.version_number), 1) AS aggregate_version FROM ${table} AS aggregate LEFT JOIN ${versions} AS version ON version.${foreign} = aggregate.id WHERE aggregate.public_id = ? AND aggregate.organization_id = ? AND aggregate.scope = 'organization' AND aggregate.status = 'active' GROUP BY aggregate.id`).bind(input.command.publicId, input.context.organizationId).first<{ id: number; aggregate_version: number }>();
    if (!row) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Conteúdo não encontrado.", 404);
    const event = reusableContentEvent({ eventId: input.context.generatePublicId("event"), kind, action: "archived", aggregatePublicId: input.command.publicId, aggregateVersion: row.aggregate_version, occurredAt: input.context.occurredAt, actor: { authUserId: input.context.actor.authUserId, role: input.context.actor.role }, correlationId: input.context.correlationId, metadata: { organizationPublicId: input.context.organizationPublicId, environment: input.context.environment, source: "nutriflow-admin" } });
    const outbox = serializeDomainEventForOutbox(event);
    await this.database.batch([
      this.database.prepare(`UPDATE ${table} SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND status = 'active'`).bind(input.context.occurredAt, input.context.occurredAt, row.id, input.context.organizationId),
      this.auditStatement(input.context, `${kind}.archived`, kind, input.command.publicId, JSON.stringify({ status: "active" }), JSON.stringify({ status: "archived" })),
      this.outboxStatement(input.context.organizationId, outbox),
    ]);
    return Object.freeze({ publicId: input.command.publicId, archived: true as const });
  }

  private auditStatement(context: ReusableContentWriteContext, action: string, entityType: string, entityPublicId: string, beforeJson: string | null, afterJson: string | null) {
    return this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(context.generatePublicId("audit"), context.organizationId, context.actor.authUserId, context.actor.role, action, entityType, entityPublicId, context.correlationId, beforeJson, afterJson, context.occurredAt);
  }

  private outboxStatement(organizationId: number, row: ReturnType<typeof serializeDomainEventForOutbox>) {
    return this.database.prepare("INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(row.eventId, organizationId, row.eventType, row.eventVersion, row.aggregateType, row.aggregatePublicId, row.aggregateVersion, row.actorAuthUserId, row.correlationId, row.causationId, row.occurredAt, row.payloadJson, row.metadataJson, row.status, row.attempts, row.availableAt);
  }
}
