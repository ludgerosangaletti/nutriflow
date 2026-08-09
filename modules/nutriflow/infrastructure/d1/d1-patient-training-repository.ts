import { NUTRIFLOW_API_VERSION } from "../../contracts/v1/errors.ts";
import type { PatientTrainingPortalV1, TrainingPatientAccessStateV1, TrainingRoutineContentV1, TrainingWeekday } from "../../contracts/v1/training.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type EntitlementRow = Readonly<{ status: "active" | "inactive" }>;
type PublicationRow = Readonly<{ public_id: string; version_number: number; published_at: string; snapshot_json: string | null }>;

function weekday(now: Date): TrainingWeekday {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(now).slice(0, 3).toLowerCase();
  return ({ mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun" } as const)[short as "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"];
}

function content(value: string | null): TrainingRoutineContentV1 | null {
  try { const parsed = JSON.parse(value ?? "") as TrainingRoutineContentV1; return parsed.schemaVersion === 1 && Array.isArray(parsed.days) ? parsed : null; } catch { return null; }
}

function resolvedCard(active: boolean, routine: TrainingRoutineContentV1 | null, current: TrainingWeekday): TrainingPatientAccessStateV1 {
  if (!active) return Object.freeze({ state: "commercial", title: "Treino", subtitle: "Contrate seu treino personalizado" });
  if (!routine) return Object.freeze({ state: "preparing", title: "Treino", subtitle: "Seu treino está sendo preparado" });
  const groups = routine.days.find((day) => day.weekday === current)?.muscleGroups.map((group) => group.name.trim()).filter(Boolean) ?? [];
  return groups.length ? Object.freeze({ state: "today", title: "Treino de hoje", subtitle: groups.join(" • "), weekday: current }) : Object.freeze({ state: "rest", title: "Treino", subtitle: "Hoje é dia de descanso", weekday: current });
}

/** Returns only the patient's own active, immutable Training publication. */
export class D1PatientTrainingRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) { this.database = database; }
  async findForPatient(input: Readonly<{ organizationId: number; clientId: number; now: Date }>): Promise<PatientTrainingPortalV1> {
    const [entitlement, publication] = await Promise.all([
      this.database.prepare("SELECT status FROM nf_training_entitlements WHERE organization_id = ? AND client_id = ? LIMIT 1").bind(input.organizationId, input.clientId).first<EntitlementRow>(),
      this.database.prepare(`SELECT publication.public_id, version.version_number, publication.published_at, version.snapshot_json
        FROM nf_training_publications AS publication INNER JOIN nf_training_routine_versions AS version ON version.id = publication.routine_version_id
        WHERE publication.organization_id = ? AND publication.client_id = ? AND publication.status = 'active'
        ORDER BY publication.published_at DESC, publication.id DESC LIMIT 1`).bind(input.organizationId, input.clientId).first<PublicationRow>(),
    ]);
    const currentWeekday = weekday(input.now);
    const active = entitlement?.status === "active";
    const routine = active ? content(publication?.snapshot_json ?? null) : null;
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, card: resolvedCard(active, routine, currentWeekday), currentWeekday, publication: active && publication && routine ? Object.freeze({ publicId: publication.public_id, versionNumber: publication.version_number, publishedAt: publication.published_at, content: routine }) : null });
  }
}
