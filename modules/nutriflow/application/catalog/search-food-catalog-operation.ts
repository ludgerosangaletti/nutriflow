import type { FoodCatalogSearchResultV1, SearchFoodCatalogQueryV1 } from "../../contracts/v1/catalog.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";
import { SearchFoodCatalog } from "./search-food-catalog.ts";

export class SearchFoodCatalogOperation {
  private readonly runner: NutriFlowOperationRunner;
  private readonly search: SearchFoodCatalog;
  constructor(dependencies: Readonly<{ runner: NutriFlowOperationRunner; search: SearchFoodCatalog }>) {
    this.runner = dependencies.runner;
    this.search = dependencies.search;
  }
  execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; query: SearchFoodCatalogQueryV1 }>): Promise<NutriFlowOperationResult<FoodCatalogSearchResultV1>> {
    return this.runner.run({
      operation: "catalog.food.search.v1",
      suppliedCorrelationId: input.query.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG,
      actor: input.actor,
      action: NUTRIFLOW_ACTIONS.READ_CATALOG,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId },
      organizationId: input.organizationId,
      execute: () => this.search.execute({ organizationId: input.organizationId, query: input.query }),
    });
  }
}

