import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import type {
  ArchiveReusableContentCommandV1,
  SaveMealTemplateCommandV1,
  SaveRecipeCommandV1,
  SearchReusableContentQueryV1,
} from "../../contracts/v1/reusable-content.ts";
import type { ReusableContentRepository } from "../ports/reusable-content-repository.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";

type StaffActor = Extract<NutriFlowActor, { kind: "staff" }>;
type Base = Readonly<{ actor: StaffActor; organizationId: number; organizationPublicId: string; clientId: number }>;
type Idempotent = Readonly<{ idempotencyKey: string; requestHash: string }>;

export class ReusableContentOperations {
  private readonly dependencies: Readonly<{
    runner: NutriFlowOperationRunner;
    repository: ReusableContentRepository;
    generatePublicId: (kind: string) => string;
    environment: string;
  }>;
  constructor(dependencies: Readonly<{
    runner: NutriFlowOperationRunner;
    repository: ReusableContentRepository;
    generatePublicId: (kind: string) => string;
    environment: string;
  }>) { this.dependencies = dependencies; }

  searchMealTemplates(input: Base & Readonly<{ query: SearchReusableContentQueryV1 }>) {
    return this.dependencies.runner.run({
      operation: "catalog.meal-template.search.v1", suppliedCorrelationId: input.query.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_MEAL_TEMPLATES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      execute: () => this.dependencies.repository.searchMealTemplates({ organizationId: input.organizationId, query: input.query }),
    });
  }

  saveMealTemplate(input: Base & Idempotent & Readonly<{ command: SaveMealTemplateCommandV1 }>) {
    return this.dependencies.runner.run({
      operation: "meal-template.version.create.v1", suppliedCorrelationId: input.command.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_MEAL_TEMPLATES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) },
      execute: ({ correlationId, now }) => this.dependencies.repository.saveMealTemplate({ context: this.writeContext(input, correlationId, now), command: input.command }),
    });
  }

  archiveMealTemplate(input: Base & Idempotent & Readonly<{ command: ArchiveReusableContentCommandV1 }>) {
    return this.dependencies.runner.run({
      operation: "meal-template.archive.v1", suppliedCorrelationId: input.command.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_MEAL_TEMPLATES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) },
      execute: ({ correlationId, now }) => this.dependencies.repository.archiveMealTemplate({ context: this.writeContext(input, correlationId, now), command: input.command }),
    });
  }

  searchRecipes(input: Base & Readonly<{ query: SearchReusableContentQueryV1 }>) {
    return this.dependencies.runner.run({
      operation: "catalog.recipe.search.v1", suppliedCorrelationId: input.query.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.RECIPES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_RECIPES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      execute: () => this.dependencies.repository.searchRecipes({ organizationId: input.organizationId, query: input.query }),
    });
  }

  saveRecipe(input: Base & Idempotent & Readonly<{ command: SaveRecipeCommandV1 }>) {
    return this.dependencies.runner.run({
      operation: "recipe.version.create.v1", suppliedCorrelationId: input.command.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.RECIPES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_RECIPES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) },
      execute: ({ correlationId, now }) => this.dependencies.repository.saveRecipe({ context: this.writeContext(input, correlationId, now), command: input.command }),
    });
  }

  archiveRecipe(input: Base & Idempotent & Readonly<{ command: ArchiveReusableContentCommandV1 }>) {
    return this.dependencies.runner.run({
      operation: "recipe.archive.v1", suppliedCorrelationId: input.command.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.RECIPES, actor: input.actor, action: NUTRIFLOW_ACTIONS.MANAGE_RECIPES,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) },
      execute: ({ correlationId, now }) => this.dependencies.repository.archiveRecipe({ context: this.writeContext(input, correlationId, now), command: input.command }),
    });
  }

  private writeContext(input: Base, correlationId: string, now: Date) {
    return Object.freeze({ organizationId: input.organizationId, organizationPublicId: input.organizationPublicId, actor: input.actor, correlationId, occurredAt: now.toISOString(), environment: this.dependencies.environment, generatePublicId: this.dependencies.generatePublicId });
  }
}
