import { canUseNutriFlowPatientPortal, createNutriFlowPatientRuntime, resolveNutriFlowPatientContext } from "../../../../nutriflow/server";
import { getPatientUser } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char] ?? char);
}

export async function GET() {
  const user = await getPatientUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowPatientPortal(context))) return new Response("Plano indisponível", { status: 404 });
  const portal = await createNutriFlowPatientRuntime().getPortal.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId, patientName: context.patientName, modality: context.modality });
  if (!portal.plan) return new Response("Nenhum plano publicado", { status: 404 });
  const plan = portal.plan;
  const macro = (value: { energyKcal?: number | null; protein?: number | null; carbohydrate?: number | null; fat?: number | null; fiber?: number | null } | null | undefined) => value ? [value.energyKcal != null ? `${Math.round(value.energyKcal)} kcal` : "", value.protein != null ? `P ${Number(value.protein).toFixed(1)} g` : "", value.carbohydrate != null ? `C ${Number(value.carbohydrate).toFixed(1)} g` : "", value.fat != null ? `G ${Number(value.fat).toFixed(1)} g` : "", value.fiber != null ? `F ${Number(value.fiber).toFixed(1)} g` : ""].filter(Boolean).join(" · ") : "";
  const body = plan.days.map((day) => `<section><h2>${esc(day.label)}</h2>${day.meals.map((meal) => `<article><h3>${esc(meal.scheduledTime ? `${meal.scheduledTime} · ` : "")}${esc(meal.title)}</h3><p class="macro">${esc(macro(meal.macros))}</p><ul>${meal.items.map((item) => `<li><strong>${esc(item.displayName)}</strong> — ${esc(item.quantityMilli / 1000)} ${esc(item.unit.label)}${item.preparation ? ` <small>(${esc(item.preparation)})</small>` : ""}</li>`).join("")}</ul>${meal.instructions ? `<p>${esc(meal.instructions)}</p>` : ""}</article>`).join("")}</section>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(plan.title)}</title><style>body{font:14px Arial;color:#111;max-width:820px;margin:32px auto;line-height:1.45}h1{font-size:28px;margin-bottom:4px}h2{margin-top:28px;border-bottom:2px solid #ffe600;padding-bottom:6px}article{break-inside:avoid;border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0}h3{margin:0 0 4px}.macro{font-weight:bold;color:#555;font-size:12px}ul{margin:8px 0;padding-left:20px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / salvar PDF</button><h1>${esc(plan.title)}</h1><p>Paciente: ${esc(portal.patient.firstName)} · Versão ${plan.versionNumber} · Publicado em ${esc(plan.publishedAt.slice(0,10))}</p><p class="macro">Resumo diário: ${esc(macro(plan.macros))}</p>${body}</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `inline; filename="plano-nutriflow-${context.actor.clientId}.html"`, "cache-control": "private, no-store" } });
}
