import type {
  ArchiveReusableContentCommandV1,
  MealTemplateVersionV1,
  RecipeVersionV1,
  ReusableContentSearchResultV1,
  SaveMealTemplateCommandV1,
  SaveRecipeCommandV1,
  SearchReusableContentQueryV1,
} from "../../contracts/v1/reusable-content.ts";
import type { NutriFlowActor } from "../security/authorization.ts";

export type ReusableContentWriteContext = Readonly<{
  organizationId: number;
  organizationPublicId: string;
  actor: Extract<NutriFlowActor, { kind: "staff" }>;
  correlationId: string;
  occurredAt: string;
  environment: string;
  generatePublicId: (kind: string) => string;
}>;

export interface ReusableContentRepository {
  searchMealTemplates(input: Readonly<{ organizationId: number; query: SearchReusableContentQueryV1 }>): Promise<ReusableContentSearchResultV1<MealTemplateVersionV1>>;
  saveMealTemplate(input: Readonly<{ context: ReusableContentWriteContext; command: SaveMealTemplateCommandV1 }>): Promise<MealTemplateVersionV1>;
  archiveMealTemplate(input: Readonly<{ context: ReusableContentWriteContext; command: ArchiveReusableContentCommandV1 }>): Promise<Readonly<{ publicId: string; archived: true }>>;
  searchRecipes(input: Readonly<{ organizationId: number; query: SearchReusableContentQueryV1 }>): Promise<ReusableContentSearchResultV1<RecipeVersionV1>>;
  saveRecipe(input: Readonly<{ context: ReusableContentWriteContext; command: SaveRecipeCommandV1 }>): Promise<RecipeVersionV1>;
  archiveRecipe(input: Readonly<{ context: ReusableContentWriteContext; command: ArchiveReusableContentCommandV1 }>): Promise<Readonly<{ publicId: string; archived: true }>>;
}
