"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FoodPlanMealV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";
import type { MealTemplateVersionV1, RecipeVersionV1, ReusableContentItemV1, ReusableContentSearchResultV1 } from "../../../../../modules/nutriflow/contracts/v1/reusable-content.ts";
import { NUTRIFLOW_UNITS } from "./editor-state";

type Mode = "meal-templates" | "recipes";
type ApiEnvelope<T> = Readonly<{ data?: ReusableContentSearchResultV1<T>; message?: string }>;

function idempotencyKey(mode: Mode, action: string) { return `nutriflow-${mode}-${action}-${crypto.randomUUID()}`; }
function recordMetric(metric: string, durationMs: number, extra: Record<string, number | string | boolean> = {}) { console.info("[nutriflow.client.metric]", JSON.stringify({ metric, durationMs: Math.round(durationMs), ...extra })); }

export default function ReusableContentPanel({
  clientId,
  activeMeal,
  templatesEnabled,
  recipesEnabled,
  onApplyTemplate,
  onApplyRecipe,
  onProductivityAction,
}: Readonly<{
  clientId: number;
  activeMeal: FoodPlanMealV1 | null;
  templatesEnabled: boolean;
  recipesEnabled: boolean;
  onApplyTemplate: (template: MealTemplateVersionV1) => void;
  onApplyRecipe: (recipe: RecipeVersionV1) => void;
  onProductivityAction: (action: string) => void;
}>) {
  const initialMode: Mode = templatesEnabled ? "meal-templates" : "recipes";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<readonly MealTemplateVersionV1[]>([]);
  const [recipes, setRecipes] = useState<readonly RecipeVersionV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnitPublicId, setYieldUnitPublicId] = useState("unit_portion");
  const requestRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, readonly (MealTemplateVersionV1 | RecipeVersionV1)[]>());

  const endpoint = `/api/admin/nutriflow/${mode}`;
  const currentItems = mode === "meal-templates" ? templates : recipes;
  const foodIngredients = useMemo(() => activeMeal?.items.filter((item) => item.source.type === "food" && item.source.publicId && item.source.revisionNumber) ?? [], [activeMeal]);
  const canSave = Boolean(activeMeal && name.trim() && (mode === "meal-templates" || foodIngredients.length > 0));

  const load = useCallback(async (search: string, refresh = false) => {
    const cacheKey = `${mode}:${search.trim().toLocaleLowerCase("pt-BR")}`;
    if (!refresh && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey) ?? [];
      if (mode === "meal-templates") setTemplates(cached as readonly MealTemplateVersionV1[]); else setRecipes(cached as readonly RecipeVersionV1[]);
      setLoading(false); return;
    }
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null); const startedAt = performance.now();
    try {
      const params = new URLSearchParams({ clientId: String(clientId), query: search, limit: "16" });
      const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
      const payload = await response.json() as ApiEnvelope<MealTemplateVersionV1 | RecipeVersionV1>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Não foi possível carregar a biblioteca.");
      const next = payload.data.items;
      if (cacheRef.current.size > 30) cacheRef.current.delete(cacheRef.current.keys().next().value ?? "");
      cacheRef.current.set(cacheKey, next);
      if (mode === "meal-templates") setTemplates(next as readonly MealTemplateVersionV1[]); else setRecipes(next as readonly RecipeVersionV1[]);
      recordMetric(`editor.${mode}.search.duration`, performance.now() - startedAt, { results: next.length, cached: false });
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError((caught as Error).message);
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [clientId, endpoint, mode]);

  useEffect(() => { const timer = window.setTimeout(() => void load(query), 180); return () => window.clearTimeout(timer); }, [load, query]);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function save(release: boolean, existingPublicId: string | null = null, nameOverride?: string) {
    if (!activeMeal || !(nameOverride ?? name).trim() || (mode === "recipes" && foodIngredients.length === 0)) return;
    setSaving(true); setError(null); const startedAt = performance.now();
    const commonItems: readonly ReusableContentItemV1[] = activeMeal.items.map((item, index) => ({ ...item, sortOrder: index }));
    const unit = NUTRIFLOW_UNITS.find((entry) => entry.publicId === yieldUnitPublicId) ?? NUTRIFLOW_UNITS[3];
    const command = mode === "meal-templates" ? {
      templatePublicId: existingPublicId, name: (nameOverride ?? name).trim(), suggestedTime: activeMeal.scheduledTime, instructions: activeMeal.instructions, items: commonItems, release,
    } : {
      recipePublicId: existingPublicId, name: (nameOverride ?? name).trim(), instructions: activeMeal.instructions, yieldQuantityMilli: Math.max(1, Math.round(Number(yieldQuantity || 1) * 1000)), yieldUnit: unit, ingredients: foodIngredients.map((item, index) => ({ ...item, sortOrder: index })), release,
    };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey(mode, existingPublicId ? "version" : "create") }, body: JSON.stringify({ clientId, command }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Não foi possível salvar o conteúdo reutilizável.");
      cacheRef.current.clear(); await load(query, true); setComposerOpen(false); setVersionTarget(null); onProductivityAction(`${mode}.${existingPublicId ? "version" : "create"}`);
      recordMetric(`editor.${mode}.save.duration`, performance.now() - startedAt, { release, version: Boolean(existingPublicId) });
    } catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
  }

  async function archive(publicId: string) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey(mode, "archive") }, body: JSON.stringify({ clientId, command: { publicId } }) });
      if (!response.ok) throw new Error("Não foi possível arquivar.");
      cacheRef.current.clear(); await load(query, true); onProductivityAction(`${mode}.archive`);
    } catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
  }

  function beginVersion(item: MealTemplateVersionV1 | RecipeVersionV1) {
    setVersionTarget("templatePublicId" in item ? item.templatePublicId : item.recipePublicId);
    setName(item.name);
    if ("recipePublicId" in item) {
      setYieldQuantity(String(item.yieldQuantityMilli / 1000));
      setYieldUnitPublicId(item.yieldUnit.publicId);
    }
    setComposerOpen(true);
  }

  return <aside className="nutriflow-reusable-panel" aria-label="Conteúdo reutilizável">
    <header><div><span>REUTILIZAR</span><strong>Conteúdo clínico</strong></div><button type="button" onClick={() => { setVersionTarget(null); setComposerOpen((open) => !open); if (activeMeal) setName(activeMeal.title); }} disabled={!activeMeal}>＋</button></header>
    {templatesEnabled && recipesEnabled ? <div className="nutriflow-reusable-tabs"><button type="button" className={mode === "meal-templates" ? "is-active" : ""} onClick={() => { setMode("meal-templates"); setQuery(""); }}>Modelos</button><button type="button" className={mode === "recipes" ? "is-active" : ""} onClick={() => { setMode("recipes"); setQuery(""); }}>Receitas</button></div> : null}
    {composerOpen ? <section className="nutriflow-reusable-composer"><strong>{versionTarget ? "Criar nova versão com a refeição atual" : mode === "meal-templates" ? "Salvar refeição como modelo" : "Criar receita com os alimentos"}</strong><input aria-label="Nome do conteúdo reutilizável" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} placeholder={mode === "meal-templates" ? "Ex.: Café da manhã proteico" : "Ex.: Overnight oats"} />{mode === "recipes" ? <div><label>Rendimento<input type="number" min="0.001" step="0.5" value={yieldQuantity} onChange={(event) => setYieldQuantity(event.target.value)} /></label><label>Unidade<select value={yieldUnitPublicId} onChange={(event) => setYieldUnitPublicId(event.target.value)}>{NUTRIFLOW_UNITS.map((entry) => <option key={entry.publicId} value={entry.publicId}>{entry.label}</option>)}</select></label><small>{foodIngredients.length} ingrediente(s) versionado(s). Itens manuais não entram na receita.</small></div> : null}<footer><button type="button" disabled={!canSave || saving} onClick={() => void save(false, versionTarget)}>Salvar rascunho</button><button className="is-primary" type="button" disabled={!canSave || saving} onClick={() => void save(true, versionTarget)}>Salvar e liberar</button></footer></section> : null}
    <label className="nutriflow-reusable-search"><span className="sr-only">Pesquisar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "meal-templates" ? "Buscar modelos…" : "Buscar receitas…"} /></label>
    {error ? <p className="nutriflow-reusable-error">{error}</p> : null}
    <div className="nutriflow-reusable-list">{loading ? <p>Carregando…</p> : currentItems.length === 0 ? <p>Nenhum conteúdo salvo.</p> : currentItems.map((item) => {
      const template = "templatePublicId" in item; const publicId = template ? item.templatePublicId : item.recipePublicId;
      return <article key={item.versionPublicId}><div><strong>{item.name}</strong><small>v{item.versionNumber} · {item.state === "released" ? "liberado" : "rascunho"}</small></div><p>{template ? `${item.items.length} item(ns)${item.suggestedTime ? ` · ${item.suggestedTime}` : ""}` : `${item.ingredients.length} ingrediente(s) · ${item.yieldQuantityMilli / 1000} ${item.yieldUnit.label}`}</p><footer>{item.state === "released" ? <button className="is-primary" type="button" disabled={!activeMeal} onClick={() => { if (template) onApplyTemplate(item); else onApplyRecipe(item); onProductivityAction(`${mode}.apply`); }}>Aplicar</button> : null}<button type="button" disabled={!activeMeal || saving} onClick={() => beginVersion(item)}>Nova versão</button><button className="is-danger" type="button" disabled={saving} onClick={() => void archive(publicId)}>Arquivar</button></footer></article>;
    })}</div>
  </aside>;
}
