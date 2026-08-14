import { env } from "cloudflare:workers";
import type { PatientPortalPlanV1 } from "../../modules/nutriflow/contracts/v1/patient-portal.ts";
import type {
  ClinicalReportPhoto,
  ReportRecipeSnapshot,
} from "../../modules/nutriflow/reports/professional-pdf.ts";
import { clinicalAssessmentPoint } from "../../modules/nutriflow/reports/professional-pdf.ts";

export const NUTRITIONIST = Object.freeze({
  name: "Ludgero Sangaletti",
  registration: "CRN-8 11719",
});

type RecipeRow = Readonly<{ snapshot_json: string | null }>;

function recipeReferences(plan: PatientPortalPlanV1) {
  const references = new Map<string, Readonly<{ publicId: string; versionNumber: number }>>();
  for (const strategy of plan.days) for (const meal of strategy.meals) {
    const items = [...meal.items, ...meal.options.flatMap((option) => option.items)];
    for (const item of items) if (item.recipe) {
      references.set(`${item.recipe.publicId}@${item.recipe.versionNumber}`, item.recipe);
    }
  }
  return references;
}

export async function loadRecipeSnapshots(plan: PatientPortalPlanV1, organizationId: number) {
  const recipes: Record<string, ReportRecipeSnapshot> = {};
  await Promise.all([...recipeReferences(plan)].map(async ([key, reference]) => {
    const row = await env.DB.prepare(
      `SELECT version.snapshot_json
       FROM nf_recipe_versions AS version
       INNER JOIN nf_recipes AS recipe ON recipe.id = version.recipe_id
       WHERE recipe.public_id = ? AND version.version_number = ?
         AND (recipe.scope = 'global' OR recipe.organization_id = ?)
       LIMIT 1`,
    ).bind(reference.publicId, reference.versionNumber, organizationId).first<RecipeRow>();
    if (!row?.snapshot_json) return;
    try {
      const parsed = JSON.parse(row.snapshot_json) as ReportRecipeSnapshot;
      if (parsed?.name && Array.isArray(parsed.ingredients)) recipes[key] = parsed;
    } catch { /* a publicação continua válida mesmo se uma receita legada estiver incompleta */ }
  }));
  return Object.freeze(recipes);
}

export async function loadReportLogo(request: Request) {
  try {
    const response = await fetch(new URL("/brand/nutriflow-report-logo.png", request.url));
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

export const assessmentPoint = clinicalAssessmentPoint;

export async function loadAssessmentPhotos(clientEmail: string, capturedAt: string): Promise<readonly ClinicalReportPhoto[]> {
  const period = capturedAt.slice(0, 7);
  const rows = await env.DB.prepare(
    `SELECT angle, period, object_key, content_type FROM progress_photos
     WHERE client_email = ? AND period = ? ORDER BY angle`,
  ).bind(clientEmail, period).all<Readonly<{ angle: string; period: string; object_key: string; content_type: string }>>();
  const photos = await Promise.all(rows.results.map(async (row) => {
    if (!(["front", "side", "back"] as const).includes(row.angle as "front" | "side" | "back")) return null;
    const object = await env.BUCKET.get(row.object_key);
    if (!object) return null;
    return Object.freeze({
      angle: row.angle as "front" | "side" | "back",
      period: row.period,
      contentType: row.content_type,
      bytes: new Uint8Array(await object.arrayBuffer()),
    });
  }));
  return Object.freeze(photos.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)));
}
