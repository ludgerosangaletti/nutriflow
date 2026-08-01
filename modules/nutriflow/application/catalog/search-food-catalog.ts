import type { SearchFoodCatalogQueryV1 } from "../../contracts/v1/catalog.ts";
import type { FoodCatalogReadRepository } from "../ports/food-catalog-repository.ts";

export class SearchFoodCatalog {
  private readonly repository: FoodCatalogReadRepository;
  constructor(repository: FoodCatalogReadRepository) { this.repository = repository; }
  execute(input: Readonly<{ organizationId: number; query: SearchFoodCatalogQueryV1 }>) {
    return this.repository.search(input);
  }
}

