import type { PatientPortalV1 } from "../../contracts/v1/patient-portal.ts";

export type PatientPortalReadRecord = Readonly<{
  organizationPublicId: string;
  clientId: number;
  publicationStatus: "active" | "revoked" | null;
  portal: PatientPortalV1;
}>;

export interface PatientPortalReadRepository {
  findForPatient(input: Readonly<{
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    patientName: string;
    modality: "online" | "in_person";
    now: Date;
  }>): Promise<PatientPortalReadRecord>;
}

