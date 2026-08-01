import { NUTRIFLOW_API_VERSION } from "../../contracts/v1/errors.ts";
import type {
  PatientPortalDayV1,
  PatientPortalItemV1,
  PatientPortalPlanV1,
  PatientPortalSubstitutionV1,
  PatientPortalUnitV1,
  PatientPortalV1,
} from "../../contracts/v1/patient-portal.ts";
import type {
  PatientPortalReadRecord,
  PatientPortalReadRepository,
} from "../../application/ports/patient-portal-repository.ts";
import type { PublishedFoodPlanSnapshotV1 } from "../../domain/plans/food-plan-content.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type PublicationRow = Readonly<{
  publication_public_id: string;
  plan_public_id: string;
  plan_version_public_id: string;
  client_id: number;
  status: "active" | "revoked";
  version_number: number;
  title: string;
  content_hash: string;
  snapshot_json: string;
  published_at: string;
}>;
type WeightRow = Readonly<{ week_start: string; weight_kg: string | null; created_at: string }>;
type AssessmentRow = Readonly<{ id: number; title: string; published_at: string }>;
type CheckInRow = Readonly<{ week_start: string; created_at: string }>;

function currentWeekStart(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function safeSnapshot(value: string): PublishedFoodPlanSnapshotV1 | null {
  try {
    const parsed = JSON.parse(value) as Partial<PublishedFoodPlanSnapshotV1>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.days) || !Array.isArray(parsed.meals) || !Array.isArray(parsed.planNotes)) return null;
    return parsed as PublishedFoodPlanSnapshotV1;
  } catch {
    return null;
  }
}

function unit(publicId: string, code: string, label: string): PatientPortalUnitV1 {
  return Object.freeze({ publicId, code, label });
}

function portalItem(item: PublishedFoodPlanSnapshotV1["meals"][number]["items"][number]): PatientPortalItemV1 {
  return Object.freeze({
    publicId: item.publicId,
    kind: item.source.type,
    displayName: item.displayName,
    quantityMilli: item.quantityMilli,
    unit: unit(item.unitPublicId, item.unitCode, item.unitLabel),
    preparation: item.preparation,
    notes: item.notes,
    recipe: item.source.type === "recipe" && item.source.publicId && item.source.revisionNumber
      ? Object.freeze({ publicId: item.source.publicId, versionNumber: item.source.revisionNumber, instructions: item.preparation })
      : null,
  });
}

function substitution(group: PublishedFoodPlanSnapshotV1["meals"][number]["substitutions"][number]): PatientPortalSubstitutionV1 {
  return Object.freeze({
    publicId: group.publicId,
    title: group.title,
    notes: group.notes,
    options: Object.freeze(group.options.map((option) => Object.freeze({
      publicId: option.publicId,
      displayName: option.displayName,
      quantityMilli: option.quantityMilli,
      unit: unit(option.unitPublicId, option.unitCode, option.unitLabel),
      notes: option.notes,
    }))),
  });
}

function planFrom(row: PublicationRow, snapshot: PublishedFoodPlanSnapshotV1): PatientPortalPlanV1 {
  const days: PatientPortalDayV1[] = snapshot.days
    .toSorted((left, right) => left.sortOrder - right.sortOrder)
    .map((day) => Object.freeze({
      publicId: day.publicId,
      label: day.label,
      dayIndex: day.dayIndex,
      meals: Object.freeze(snapshot.meals
        .filter((meal) => meal.planDayPublicId === day.publicId)
        .toSorted((left, right) => left.sortOrder - right.sortOrder)
        .map((meal) => Object.freeze({
          publicId: meal.publicId,
          title: meal.title,
          scheduledTime: meal.scheduledTime,
          instructions: meal.instructions,
          items: Object.freeze(meal.items.toSorted((left, right) => left.sortOrder - right.sortOrder).map(portalItem)),
          substitutions: Object.freeze(meal.substitutions.toSorted((left, right) => left.sortOrder - right.sortOrder).map(substitution)),
        }))),
    }));
  return Object.freeze({
    publicationPublicId: row.publication_public_id,
    planPublicId: row.plan_public_id,
    planVersionPublicId: row.plan_version_public_id,
    title: snapshot.title || row.title,
    versionNumber: row.version_number,
    contentHash: row.content_hash,
    publishedAt: row.published_at,
    notes: snapshot.notes,
    patientNotes: Object.freeze(snapshot.planNotes
      .filter((note) => note.kind === "patient" || note.kind === "general")
      .toSorted((left, right) => left.sortOrder - right.sortOrder)
      .map((note) => note.content)),
    days: Object.freeze(days),
  });
}

export class D1PatientPortalRepository implements PatientPortalReadRepository {
  private readonly database: D1OperationDatabaseLike;

  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async findForPatient(input: Parameters<PatientPortalReadRepository["findForPatient"]>[0]): Promise<PatientPortalReadRecord> {
    const [publication, weights, assessment, latestCheckIn] = await Promise.all([
      this.database.prepare(`SELECT publication.public_id AS publication_public_id, plan.public_id AS plan_public_id,
          version.public_id AS plan_version_public_id, plan.client_id, publication.status, version.version_number,
          version.title, version.content_hash, version.snapshot_json, publication.published_at
        FROM nf_publications AS publication
        INNER JOIN nf_plans AS plan ON plan.id = publication.plan_id
        INNER JOIN nf_plan_versions AS version ON version.id = publication.plan_version_id
        WHERE publication.organization_id = ? AND publication.client_id = ? AND publication.status = 'active'
        ORDER BY publication.published_at DESC, publication.id DESC LIMIT 1`)
        .bind(input.organizationId, input.clientId).first<PublicationRow>(),
      this.database.prepare(`SELECT checkin.week_start, checkin.weight_kg, checkin.created_at
        FROM check_ins AS checkin INNER JOIN clients AS client ON client.email = checkin.client_email
        WHERE client.id = ? AND checkin.weight_kg IS NOT NULL AND trim(checkin.weight_kg) <> ''
        ORDER BY checkin.week_start ASC LIMIT 52`).bind(input.clientId).all<WeightRow>(),
      this.database.prepare(`SELECT document.id, document.title, document.published_at
        FROM patient_documents AS document INNER JOIN clients AS client ON client.email = document.client_email
        WHERE client.id = ? AND document.document_type = 'physical_assessment' AND document.is_current = 1
        ORDER BY document.published_at DESC, document.id DESC LIMIT 1`).bind(input.clientId).first<AssessmentRow>(),
      this.database.prepare(`SELECT checkin.week_start, checkin.created_at
        FROM check_ins AS checkin INNER JOIN clients AS client ON client.email = checkin.client_email
        WHERE client.id = ? ORDER BY checkin.week_start DESC, checkin.id DESC LIMIT 1`).bind(input.clientId).first<CheckInRow>(),
    ]);

    const snapshot = publication?.snapshot_json ? safeSnapshot(publication.snapshot_json) : null;
    const plan = publication && snapshot ? planFrom(publication, snapshot) : null;
    const weightEvolution = weights.results.flatMap((row) => {
      const weightKg = Number(row.weight_kg?.replace(",", "."));
      return Number.isFinite(weightKg) && weightKg > 0
        ? [Object.freeze({ recordedAt: row.week_start || row.created_at, weightKg, source: "check-in" as const })]
        : [];
    });
    const week = currentWeekStart(input.now);
    const checkInStatus = latestCheckIn?.week_start === week ? "completed-this-week" : "available";
    const portal: PatientPortalV1 = Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      generatedAt: input.now.toISOString(),
      patient: Object.freeze({ firstName: input.patientName.trim().split(/\s+/)[0] || "Paciente", modality: input.modality }),
      plan,
      physicalAssessment: Object.freeze({
        available: Boolean(assessment),
        title: assessment?.title ?? null,
        publishedAt: assessment?.published_at ?? null,
        href: assessment ? "/documentos" : null,
      }),
      weightEvolution: Object.freeze(weightEvolution),
      checkIn: Object.freeze({
        status: checkInStatus,
        latestSubmittedAt: latestCheckIn?.created_at ?? null,
        href: "/check-in",
      }),
    });
    return Object.freeze({
      organizationPublicId: input.organizationPublicId,
      clientId: publication?.client_id ?? input.clientId,
      publicationStatus: publication?.status ?? null,
      portal,
    });
  }
}
