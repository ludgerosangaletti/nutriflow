import type { SearchTrainingExerciseLibraryQueryV1 } from "../../contracts/v1/training.ts";
import type { TrainingLibraryRepository } from "../ports/training-library-repository.ts";

export class SearchTrainingExerciseLibrary {
  private readonly repository: TrainingLibraryRepository;

  constructor(repository: TrainingLibraryRepository) {
    this.repository = repository;
  }

  execute(input: Readonly<{
    organizationId: number;
    query: SearchTrainingExerciseLibraryQueryV1;
  }>) {
    return this.repository.search(input);
  }
}
