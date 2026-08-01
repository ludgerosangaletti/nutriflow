import type { FoodCatalogSearchResultV1, SearchFoodCatalogQueryV1 } from "../../contracts/v1/catalog.ts";

export interface FoodCatalogReadRepository {
  search(input: Readonly<{ organizationId: number; query: SearchFoodCatalogQueryV1 }>): Promise<FoodCatalogSearchResultV1>;
}

