import type {
  SearchTrainingExerciseLibraryQueryV1,
  TrainingExerciseLibraryItemV1,
} from "../../contracts/v1/training.ts";

export type TrainingExerciseLibrarySearchResultV1 = Readonly<{
  query: string;
  items: readonly TrainingExerciseLibraryItemV1[];
  hasMore: boolean;
}>;

/**
 * Read-only catalog boundary. Implementations must expose only global exercises
 * and exercises owned by the requested organization.
 */
export interface TrainingLibraryRepository {
  search(input: Readonly<{
    organizationId: number;
    query: SearchTrainingExerciseLibraryQueryV1;
  }>): Promise<TrainingExerciseLibrarySearchResultV1>;
}
