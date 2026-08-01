import type { PatientPortalV1 } from "../../contracts/v1/patient-portal.ts";
import { NUTRIFLOW_ACTIONS, assertNutriFlowAuthorized, type NutriFlowActor } from "../security/authorization.ts";
import type { PatientPortalReadRepository } from "../ports/patient-portal-repository.ts";

export class GetPatientPortal {
  private readonly repository: PatientPortalReadRepository;

  constructor(repository: PatientPortalReadRepository) {
    this.repository = repository;
  }

  async execute(input: Readonly<{
    actor: Extract<NutriFlowActor, { kind: "patient" }>;
    organizationId: number;
    organizationPublicId: string;
    patientName: string;
    modality: "online" | "in_person";
    now?: Date;
  }>): Promise<PatientPortalV1> {
    const now = input.now ?? new Date();
    const record = await this.repository.findForPatient({
      organizationId: input.organizationId,
      organizationPublicId: input.organizationPublicId,
      clientId: input.actor.clientId,
      patientName: input.patientName,
      modality: input.modality,
      now,
    });
    assertNutriFlowAuthorized(input.actor, NUTRIFLOW_ACTIONS.READ_PATIENT_PORTAL, {
      organizationPublicId: record.organizationPublicId,
      clientId: record.clientId,
      publicationStatus: record.publicationStatus,
    }, now);
    return record.portal;
  }
}
