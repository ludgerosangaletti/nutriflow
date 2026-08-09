import type { PatientTrainingPortalV1 } from "../../contracts/v1/training.ts";
import { NUTRIFLOW_ACTIONS, assertNutriFlowAuthorized, type NutriFlowActor } from "../security/authorization.ts";
import { D1PatientTrainingRepository } from "../../infrastructure/d1/d1-patient-training-repository.ts";

export class GetPatientTraining {
  private readonly repository: D1PatientTrainingRepository;
  constructor(repository: D1PatientTrainingRepository) { this.repository = repository; }
  async execute(input: Readonly<{ actor: Extract<NutriFlowActor, { kind: "patient" }>; organizationId: number; organizationPublicId: string; now?: Date }>): Promise<PatientTrainingPortalV1> {
    const now = input.now ?? new Date();
    assertNutriFlowAuthorized(input.actor, NUTRIFLOW_ACTIONS.READ_TRAINING, { organizationPublicId: input.organizationPublicId, clientId: input.actor.clientId }, now);
    return this.repository.findForPatient({ organizationId: input.organizationId, clientId: input.actor.clientId, now });
  }
}
