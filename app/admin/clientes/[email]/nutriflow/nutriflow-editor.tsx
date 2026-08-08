"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FoodCatalogItemV1 } from "../../../../../modules/nutriflow/contracts/v1/catalog.ts";
import type { FoodPlanDraftV1, PublishedFoodPlanV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";
import type { MealTemplateVersionV1, RecipeVersionV1 } from "../../../../../modules/nutriflow/contracts/v1/reusable-content.ts";
import { EditorLoadingSkeleton, EditorNotice, SyncIndicator, type EditorSyncState } from "./editor-components";
import FoodLibraryPanel from "./food-library-panel";
import ReusableContentPanel from "./reusable-content-panel";
import {
  NUTRIFLOW_UNITS,
  addCatalogItem,
  addDay,
  addItem,
  addMeal,
  addMealOption,
  addRecipeItem,
  addSubstitutionGroup,
  addSubstitutionOption,
  removeSubstitutionOption,
  updateSubstitutionOption,
  applyMealTemplate,
  duplicateDay,
  duplicateItem,
  duplicateMeal,
  editorId,
  moveDay,
  moveItem,
  moveMeal,
  moveMealToDay,
  removeDay,
  removeItem,
  removeMeal,
  removeMealOption,
  removeSubstitutionGroup,
  mealOptions,
  updateItem,
  updateMeal,
  updateMealOptionLabel,
  updateSubstitutionGroup,
} from "./editor-state";

type ApiEnvelope = { data?: FoodPlanDraftV1; errorCode?: string; message?: string };
type PublicationEnvelope = { data?: PublishedFoodPlanV1; errorCode?: string; message?: string };
type EditorTools = Readonly<{ catalogEnabled: boolean; recipesEnabled: boolean; mealTemplatesEnabled: boolean }>;

function formatSavedAt(value: string | null) {
  if (!value) return "Ainda não sincronizado";
  return `Salvo às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value))}`;
}
function recordClientMetric(metric: string, durationMs: number, extra: Record<string, number | string | boolean> = {}) {
  console.info("[nutriflow.client.metric]", JSON.stringify({ metric, durationMs: Math.round(durationMs), ...extra }));
}

function looksLikeMeasurementOnly(value: string) {
  return /^\s*\d+(?:[.,]\d+)?(?:\s*(?:a|à|-)\s*\d+(?:[.,]\d+)?)?\s+(?:colher(?:es)?|x[ií]cara(?:s)?|grama(?:s)?|quilo(?:s)?|ml|mililitro(?:s)?|unidade(?:s)?|fatia(?:s)?|porç(?:ão|ões))\s*$/i.test(value);
}

async function fetchWithOneRetry(input: RequestInfo | URL, init: RequestInit) {
  const key = init.headers instanceof Headers ? init.headers.get("idempotency-key") : (init.headers as Record<string, string> | undefined)?.["idempotency-key"];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.status < 500 || attempt === 2) return response;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(`Falha de sincronização ${key ?? ""}`);
}

export default function NutriFlowEditor({ clientId, patientName, tools }: { clientId: number; patientName: string; tools: EditorTools }) {
  const [draft, setDraft] = useState<FoodPlanDraftV1 | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<EditorSyncState>("loading");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [publication, setPublication] = useState<PublishedFoodPlanV1 | null>(null);
  const [collapsedMealIds, setCollapsedMealIds] = useState<Set<string>>(() => new Set());
  const [selectedMealOptionIds, setSelectedMealOptionIds] = useState<Record<string, string>>({});
  const latestDraft = useRef<FoodPlanDraftV1 | null>(null);
  const syncStateRef = useRef<EditorSyncState>("loading");
  const changeVersion = useRef(0);
  const saveInFlight = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNowRef = useRef<() => Promise<void>>(async () => undefined);
  const dirtyStartedAt = useRef<number | null>(null);
  const firstAutosaveRecorded = useRef(false);
  const productivity = useRef({ startedAt: 0, actions: 0, simplePlanRecorded: false });

  const transition = useCallback((next: EditorSyncState) => {
    syncStateRef.current = next;
    setSyncState(next);
  }, []);

  function toggleMeal(mealPublicId: string) {
    setCollapsedMealIds((current) => {
      const next = new Set(current);
      if (next.has(mealPublicId)) next.delete(mealPublicId); else next.add(mealPublicId);
      return next;
    });
  }

  const loadDraft = useCallback(async () => {
    const startedAt = performance.now();
    transition("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/nutriflow/drafts?clientId=${clientId}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as ApiEnvelope;
      if (response.status === 404 && result.errorCode === "NF_NOT_FOUND") {
        latestDraft.current = null;
        setDraft(null);
        transition("saved");
        recordClientMetric("editor.open.duration", performance.now() - startedAt, { draftExists: false });
        return;
      }
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível carregar o editor.");
      latestDraft.current = result.data;
      setDraft(result.data);
      setSelectedDayId((current) => current && result.data!.content.days.some((day) => day.publicId === current) ? current : result.data!.content.days[0]?.publicId ?? null);
      setSelectedMealId((current) => current && result.data!.content.meals.some((meal) => meal.publicId === current) ? current : result.data!.content.meals[0]?.publicId ?? null);
      setLastSavedAt(result.data.updatedAt);
      transition("saved");
      recordClientMetric("editor.open.duration", performance.now() - startedAt, { draftExists: true, queryCount: 5 });
    } catch (error) {
      transition("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o editor.");
    }
  }, [clientId, transition]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadDraft(); }, 0);
    return () => clearTimeout(timer);
  }, [loadDraft]);

  const saveNow = useCallback(async () => {
    const snapshot = latestDraft.current;
    if (!snapshot || saveInFlight.current || syncStateRef.current === "conflict") return;
    if (!snapshot.title.trim()) {
      transition("error");
      setMessage("Informe um título antes de sincronizar o plano.");
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveInFlight.current = true;
    const capturedVersion = changeVersion.current;
    transition("saving");
    setMessage("");
    const startedAt = performance.now();
    const correlation = `corr_${crypto.randomUUID()}`;
    const idempotencyKey = `save_${crypto.randomUUID()}`;
    const body = JSON.stringify({ clientId, command: { apiVersion: "v1", planPublicId: snapshot.planPublicId, planVersionPublicId: snapshot.publicId, expectedRevision: snapshot.revision, title: snapshot.title, planNotes: snapshot.planNotes, content: snapshot.content, correlationId: correlation } });
    try {
      const response = await fetchWithOneRetry("/api/admin/nutriflow/drafts", { method: "PATCH", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, "x-correlation-id": correlation }, body });
      const result = await response.json().catch(() => ({})) as ApiEnvelope;
      saveInFlight.current = false;
      recordClientMetric("editor.save.duration", performance.now() - startedAt, { success: response.ok, revision: snapshot.revision });
      if (response.status === 409) {
        transition("conflict");
        setMessage("Este plano foi atualizado em outra sessão. Recarregue para continuar sem sobrescrever alterações.");
        return;
      }
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível sincronizar. Suas alterações continuam nesta tela.");
      setLastSavedAt(result.data.updatedAt);
      setDraft((current) => {
        const next = current ? { ...current, revision: result.data!.revision, updatedAt: result.data!.updatedAt } : result.data!;
        latestDraft.current = next;
        return next;
      });
      if (!firstAutosaveRecorded.current && dirtyStartedAt.current !== null) {
        firstAutosaveRecorded.current = true;
        recordClientMetric("editor.first-autosave.duration", performance.now() - dirtyStartedAt.current, { success: true });
      }
      if (changeVersion.current === capturedVersion) {
        dirtyStartedAt.current = null;
        transition("saved");
      } else {
        transition("dirty");
        saveTimer.current = setTimeout(() => { void saveNowRef.current(); }, 350);
      }
    } catch (error) {
      saveInFlight.current = false;
      transition("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível sincronizar. Suas alterações continuam nesta tela.");
    }
  }, [clientId, transition]);

  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  function mutate(updater: (current: FoodPlanDraftV1) => FoodPlanDraftV1) {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(current);
      latestDraft.current = next;
      return next;
    });
    changeVersion.current += 1;
    dirtyStartedAt.current ??= performance.now();
    transition("dirty");
    setMessage("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveNowRef.current(); }, 750);
  }

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!["dirty", "saving", "error"].includes(syncStateRef.current)) return;
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNowRef.current();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keyboard);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function showNotice(value: string) {
    setNotice(value);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2400);
  }

  function trackProductivityAction(action: string) {
    productivity.current.startedAt ||= performance.now();
    productivity.current.actions += 1;
    recordClientMetric("editor.productivity.action", 0, { action, actions: productivity.current.actions });
    queueMicrotask(() => {
      const current = latestDraft.current;
      const simplePlanReady = current?.content.meals.some((meal) => meal.items.length >= 3);
      if (!simplePlanReady || productivity.current.simplePlanRecorded) return;
      productivity.current.simplePlanRecorded = true;
      recordClientMetric("editor.simple-plan.duration", performance.now() - productivity.current.startedAt, { actions: productivity.current.actions, days: current?.content.days.length ?? 0, meals: current?.content.meals.length ?? 0 });
    });
  }

  function insertCatalogFood(food: FoodCatalogItemV1, mealPublicId: string, optionPublicId?: string) {
    mutate((current) => addCatalogItem(current, mealPublicId, food, editorId("item"), optionPublicId));
    trackProductivityAction("catalog.food.apply");
    showNotice(`${food.name} adicionado à refeição.`);
  }

  function insertTemplate(template: MealTemplateVersionV1) {
    if (!activeDayId) return;
    const mealId = editorId("meal");
    mutate((current) => applyMealTemplate(current, activeDayId, template, { meal: mealId, items: template.items.map(() => editorId("item")) }));
    setSelectedMealId(mealId);
    trackProductivityAction("meal-template.apply");
    showNotice(`${template.name} aplicado à estratégia.`);
  }

  function insertRecipe(recipe: RecipeVersionV1) {
    if (!activeMealId) return;
    const optionPublicId = activeMeal ? selectedMealOptionIds[activeMeal.publicId] ?? mealOptions(activeMeal)[0]?.publicId : undefined;
    mutate((current) => addRecipeItem(current, activeMealId, recipe, editorId("item"), optionPublicId));
    trackProductivityAction("recipe.apply");
    showNotice(`${recipe.name} adicionada à refeição.`);
  }

  async function createDraft() {
    transition("saving");
    const startedAt = performance.now();
    try {
      let response = await fetch("/api/admin/nutriflow/revisions", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `revision_${crypto.randomUUID()}` }, body: JSON.stringify({ clientId }) });
      if (response.status === 404) response = await fetch("/api/admin/nutriflow/drafts", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `create_${crypto.randomUUID()}` }, body: JSON.stringify({ clientId, title: `Plano alimentar — ${patientName}` }) });
      const result = await response.json().catch(() => ({})) as ApiEnvelope;
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível criar o rascunho.");
      latestDraft.current = result.data;
      setDraft(result.data);
      setLastSavedAt(result.data.updatedAt);
      transition("saved");
      recordClientMetric("editor.create.duration", performance.now() - startedAt, { success: true });
    } catch (error) {
      transition("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o rascunho.");
    }
  }

  async function createRevision() {
    transition("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/nutriflow/revisions", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `revision_${crypto.randomUUID()}` }, body: JSON.stringify({ clientId }) });
      const result = await response.json().catch(() => ({})) as ApiEnvelope;
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível preparar a nova versão.");
      latestDraft.current = result.data;
      setDraft(result.data);
      setPublication(null);
      setLastSavedAt(result.data.updatedAt);
      transition("saved");
    } catch (error) {
      transition("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível preparar a nova versão.");
    }
  }

  async function publishDraft() {
    const snapshot = latestDraft.current;
    if (!snapshot || syncStateRef.current !== "saved") return;
    if (!window.confirm("Publicar esta versão para o paciente? O conteúdo publicado ficará imutável e auditável.")) return;
    const startedAt = performance.now();
    transition("saving");
    setMessage("");
    const correlation = `corr_${crypto.randomUUID()}`;
    try {
      const response = await fetch("/api/admin/nutriflow/publications", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `publish_${crypto.randomUUID()}`, "x-correlation-id": correlation },
        body: JSON.stringify({ clientId, command: { apiVersion: "v1", planPublicId: snapshot.planPublicId, planVersionPublicId: snapshot.publicId, expectedRevision: snapshot.revision, correlationId: correlation } }),
      });
      const result = await response.json().catch(() => ({})) as PublicationEnvelope;
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível publicar o plano.");
      setPublication(result.data);
      transition("saved");
      recordClientMetric("editor.publish.duration", performance.now() - startedAt, { success: true, version: result.data.versionNumber });
    } catch (error) {
      transition("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível publicar o plano.");
    }
  }

  if (syncState === "loading") return <EditorLoadingSkeleton />;
  if (!draft) return <section className="nutriflow-empty"><p className="section-kicker">Plano alimentar estruturado</p><h1>Abra o plano de {patientName}</h1><p>Se já existir uma publicação, uma nova versão editável será criada sem alterar o histórico entregue ao paciente.</p><button type="button" onClick={createDraft}>Abrir plano para edição</button>{message ? <p role="alert">{message}</p> : null}</section>;
  if (publication) return <section className="nutriflow-published-confirmation"><span aria-hidden="true">✓</span><div><p className="section-kicker">Publicação concluída</p><h1>Plano disponível para o paciente.</h1><p>A versão {publication.versionNumber} foi registrada como imutável e auditada. Para um ajuste solicitado pelo paciente, crie uma nova versão: a atual continuará disponível até a próxima publicação.</p><div className="nutriflow-published-actions"><button type="button" onClick={createRevision}>Criar versão de ajustes</button><Link href="/admin/clientes">Voltar à gestão de pacientes</Link></div></div></section>;

  const activeDayId = selectedDayId && draft.content.days.some((day) => day.publicId === selectedDayId) ? selectedDayId : draft.content.days[0]?.publicId ?? null;
  const activeDay = draft.content.days.find((day) => day.publicId === activeDayId);
  const meals = draft.content.meals.filter((meal) => meal.planDayPublicId === activeDayId).sort((left, right) => left.sortOrder - right.sortOrder);
  const activeMealId = selectedMealId && meals.some((meal) => meal.publicId === selectedMealId) ? selectedMealId : meals[0]?.publicId ?? null;
  const activeMeal = meals.find((meal) => meal.publicId === activeMealId) ?? null;
  const totalOptionItems = draft.content.meals.reduce((total, meal) => total + mealOptions(meal).reduce((mealTotal, option) => mealTotal + option.items.length, 0), 0);
  const allMealOptionsReady = draft.content.meals.length > 0 && draft.content.meals.every((meal) => mealOptions(meal).every((option) => option.items.length > 0));
  const syncDetail = syncState === "saved" ? formatSavedAt(lastSavedAt) : syncState === "saving" ? "Gravação atômica em andamento" : syncState === "dirty" ? "Autosave em menos de 1 segundo" : "Autosave protegido por revisão";

  return <div className="nutriflow-editor">
    <header className="nutriflow-editor-header"><div><p className="section-kicker">Editor NutriFlow</p><input aria-label="Título do plano" maxLength={160} value={draft.title} onChange={(event) => mutate((current) => ({ ...current, title: event.target.value }))} /></div><SyncIndicator state={syncState} detail={syncDetail} /></header>
    {message ? <EditorNotice state={syncState} action={<button type="button" onClick={syncState === "conflict" ? loadDraft : saveNow}>{syncState === "conflict" ? "Recarregar versão" : "Tentar novamente"}</button>}>{message}</EditorNotice> : null}
    {notice ? <EditorNotice state="saved">{notice}</EditorNotice> : null}
    <div className={`nutriflow-editor-layout ${tools.catalogEnabled || tools.recipesEnabled || tools.mealTemplatesEnabled ? "has-library" : ""}`}>
      <main className="nutriflow-canvas">
        <nav className="nutriflow-days" aria-label="Estratégias do plano">
          {draft.content.days.map((day) => <button className={day.publicId === activeDayId ? "is-active" : ""} key={day.publicId} type="button" onClick={() => { setSelectedDayId(day.publicId); setSelectedMealId(draft.content.meals.find((meal) => meal.planDayPublicId === day.publicId)?.publicId ?? null); }}><span>{day.label}</span><small>{draft.content.meals.filter((meal) => meal.planDayPublicId === day.publicId).length} refeições</small></button>)}
          <button className="is-add" type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); setSelectedMealId(null); trackProductivityAction("day.add"); }}>＋ Nova estratégia</button>
        </nav>
        {activeDay ? <section className="nutriflow-day-panel">
          <header><div><label htmlFor="day-label">Nome da estratégia</label><input id="day-label" maxLength={120} value={activeDay.label} onChange={(event) => mutate((current) => ({ ...current, content: { ...current.content, days: current.content.days.map((day) => day.publicId === activeDay.publicId ? { ...day, label: event.target.value } : day) } }))} /></div><div className="nutriflow-icon-actions"><button type="button" title="Duplicar estratégia completa" aria-label="Duplicar estratégia completa" onClick={() => { const dayId = editorId("day"); mutate((current) => duplicateDay(current, activeDay.publicId, { day: dayId, meals: meals.map((meal) => ({ meal: editorId("meal"), items: meal.items.map(() => editorId("item")) })) })); setSelectedDayId(dayId); setSelectedMealId(null); trackProductivityAction("day.duplicate"); }}>⧉ Estratégia</button><button type="button" title="Mover estratégia para a esquerda" aria-label="Mover estratégia para a esquerda" disabled={activeDay.sortOrder === 0} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, -1))}>←</button><button type="button" title="Mover estratégia para a direita" aria-label="Mover estratégia para a direita" disabled={activeDay.sortOrder === draft.content.days.length - 1} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, 1))}>→</button><button className="is-danger" type="button" onClick={() => { mutate((current) => removeDay(current, activeDay.publicId)); setSelectedDayId(draft.content.days.find((day) => day.publicId !== activeDay.publicId)?.publicId ?? null); setSelectedMealId(null); }}>Excluir estratégia</button></div></header>
          <div className="nutriflow-meals">
            {meals.map((meal, mealIndex) => {
              const collapsed = collapsedMealIds.has(meal.publicId);
              const options = mealOptions(meal);
              const optionPublicId = selectedMealOptionIds[meal.publicId] && options.some((option) => option.publicId === selectedMealOptionIds[meal.publicId]) ? selectedMealOptionIds[meal.publicId] : options[0]?.publicId;
              const activeOption = options.find((option) => option.publicId === optionPublicId) ?? options[0];
              return <article className={`nutriflow-meal ${meal.publicId === activeMealId ? "is-selected" : ""} ${collapsed ? "is-collapsed" : ""}`} key={meal.publicId} onClick={() => setSelectedMealId(meal.publicId)} onFocusCapture={() => setSelectedMealId(meal.publicId)}>
              <header><button className="nutriflow-meal-collapse" type="button" aria-expanded={!collapsed} aria-label={`${collapsed ? "Expandir" : "Recolher"} ${meal.title}`} onClick={(event) => { event.stopPropagation(); toggleMeal(meal.publicId); }}>{collapsed ? "＋" : "−"}</button><span className="nutriflow-meal-index">{String(mealIndex + 1).padStart(2, "0")}</span><div className="nutriflow-meal-title"><input aria-label="Nome da refeição" maxLength={120} value={meal.title} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { title: event.target.value }))} /><input aria-label="Horário da refeição" type="time" value={meal.scheduledTime ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { scheduledTime: event.target.value || null }))} />{draft.content.days.length > 1 ? <select aria-label="Mover refeição para outra estratégia" value={meal.planDayPublicId ?? ""} onChange={(event) => { mutate((current) => moveMealToDay(current, meal.publicId, event.target.value)); setSelectedDayId(event.target.value); setSelectedMealId(meal.publicId); trackProductivityAction("meal.move-day"); }}>{draft.content.days.map((day) => <option key={day.publicId} value={day.publicId}>{day.label}</option>)}</select> : null}</div><div className="nutriflow-icon-actions"><button type="button" title="Duplicar refeição" aria-label="Duplicar refeição" onClick={() => { const id = editorId("meal"); mutate((current) => duplicateMeal(current, meal.publicId, { meal: id, items: meal.items.map(() => editorId("item")) })); setSelectedMealId(id); trackProductivityAction("meal.duplicate"); }}>⧉</button><button type="button" aria-label="Mover refeição para cima" disabled={mealIndex === 0} onClick={() => mutate((current) => moveMeal(current, meal.publicId, -1))}>↑</button><button type="button" aria-label="Mover refeição para baixo" disabled={mealIndex === meals.length - 1} onClick={() => mutate((current) => moveMeal(current, meal.publicId, 1))}>↓</button><button className="is-danger" type="button" onClick={() => { mutate((current) => removeMeal(current, meal.publicId)); setSelectedMealId(null); }}>Excluir</button></div></header>
              {!collapsed && activeOption ? <>
              <div className="nutriflow-meal-option-editor"><div role="tablist" aria-label={`Opções de ${meal.title}`}>{options.map((option) => <button className={option.publicId === activeOption.publicId ? "is-active" : ""} key={option.publicId} type="button" role="tab" aria-selected={option.publicId === activeOption.publicId} onClick={() => setSelectedMealOptionIds((current) => ({ ...current, [meal.publicId]: option.publicId }))}>{option.label}</button>)}{options.length < 3 ? <button className="is-add" type="button" onClick={() => { const optionId = editorId("meal_option"); mutate((current) => addMealOption(current, meal.publicId, optionId)); setSelectedMealOptionIds((current) => ({ ...current, [meal.publicId]: optionId })); trackProductivityAction("meal-option.add"); }}>＋ Nova opção</button> : null}</div><label><span>Nome desta opção</span><input maxLength={80} value={activeOption.label} onChange={(event) => mutate((current) => updateMealOptionLabel(current, meal.publicId, activeOption.publicId, event.target.value))} /></label>{options.length > 1 ? <button className="is-danger" type="button" onClick={() => { const fallback = options.find((option) => option.publicId !== activeOption.publicId)?.publicId; mutate((current) => removeMealOption(current, meal.publicId, activeOption.publicId)); if (fallback) setSelectedMealOptionIds((current) => ({ ...current, [meal.publicId]: fallback })); }}>Excluir esta opção</button> : null}</div>
                <div className="nutriflow-items">
                {activeOption.items.map((item, itemIndex) => <div className="nutriflow-item" key={item.publicId}>
                  <div className="nutriflow-item-main">
                    <label><span>Alimento {item.source.type === "food" ? <b>Biblioteca v{item.source.revisionNumber}</b> : null}</span><input className={looksLikeMeasurementOnly(item.displayName) ? "has-field-warning" : ""} maxLength={200} value={item.displayName} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { displayName: event.target.value }, activeOption.publicId))} />{looksLikeMeasurementOnly(item.displayName) ? <small className="field-warning">Este campo parece conter apenas quantidade e medida. Informe aqui o nome do alimento.</small> : null}</label>
                    <label><span>Quantidade</span><input disabled={item.unit.publicId === "unit_as_desired"} inputMode="decimal" min="0.001" placeholder={item.unit.publicId === "unit_as_desired" ? "Livre" : undefined} step="0.001" type={item.unit.publicId === "unit_as_desired" ? "text" : "number"} value={item.unit.publicId === "unit_as_desired" ? "Livre" : item.quantityMilli / 1000} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { quantityMilli: Math.max(1, Math.round(Number(event.target.value || 0) * 1000)) }, activeOption.publicId))} /></label>
                    <label><span>Medida</span><select value={item.unit.publicId} onChange={(event) => { const unit = NUTRIFLOW_UNITS.find((option) => option.publicId === event.target.value)!; mutate((current) => updateItem(current, meal.publicId, item.publicId, { unit, ...(unit.publicId === "unit_as_desired" ? { quantityMilli: 1000 } : {}) }, activeOption.publicId)); }}>{NUTRIFLOW_UNITS.map((unit) => <option key={unit.publicId} value={unit.publicId}>{unit.label}</option>)}</select></label>
                    <label className="is-preparation"><span>Preparo ou detalhe</span><input maxLength={500} placeholder="Ex.: grelhado, sem açúcar" value={item.preparation ?? ""} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { preparation: event.target.value || null }, activeOption.publicId))} /></label>
                    <div className="nutriflow-item-actions"><button type="button" aria-label="Mover alimento para cima" disabled={itemIndex === 0} onClick={() => mutate((current) => moveItem(current, meal.publicId, item.publicId, -1, activeOption.publicId))}>↑</button><button type="button" aria-label="Mover alimento para baixo" disabled={itemIndex === activeOption.items.length - 1} onClick={() => mutate((current) => moveItem(current, meal.publicId, item.publicId, 1, activeOption.publicId))}>↓</button><button type="button" title="Duplicar alimento" aria-label="Duplicar alimento" onClick={() => mutate((current) => duplicateItem(current, meal.publicId, item.publicId, editorId("item"), activeOption.publicId))}>⧉</button><button className="is-danger" type="button" aria-label={`Excluir ${item.displayName}`} onClick={() => mutate((current) => removeItem(current, meal.publicId, item.publicId, activeOption.publicId))}>×</button></div>
                  </div>
                  <details className="nutriflow-item-notes"><summary>Observação opcional do alimento</summary><label><span>Orientação ou contexto</span><input maxLength={1000} placeholder="Ex.: consumir antes do treino" value={item.notes ?? ""} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { notes: event.target.value || null }, activeOption.publicId))} /></label></details>
                </div>)}
                <button className="nutriflow-add-item" type="button" onClick={() => { mutate((current) => addItem(current, meal.publicId, editorId("item"), activeOption.publicId)); trackProductivityAction("food.manual.add"); }}>＋ Adicionar alimento manualmente</button>
              </div>
              {activeOption.items.length ? <details className="nutriflow-editor-options"><summary>Trocas pontuais desta opção</summary>{(activeOption.substitutions ?? []).map((group) => <section key={group.publicId}><header><input aria-label="Título da troca" list="nutriflow-swap-labels" value={group.title} onChange={(event) => mutate((current) => updateSubstitutionGroup(current, meal.publicId, group.publicId, { title: event.target.value }, activeOption.publicId))} /><button type="button" onClick={() => mutate((current) => addSubstitutionOption(current, meal.publicId, group.publicId, activeOption.publicId))}>+ alternativa</button><button className="is-danger" type="button" onClick={() => mutate((current) => removeSubstitutionGroup(current, meal.publicId, group.publicId, activeOption.publicId))}>Excluir troca</button></header>{group.options.map((option) => <div className="nutriflow-option-row" key={option.publicId}><label><span>Alimento alternativo</span><input className={looksLikeMeasurementOnly(option.displayName) ? "has-field-warning" : ""} value={option.displayName} onChange={(event) => mutate((current) => updateSubstitutionOption(current, meal.publicId, group.publicId, option.publicId, { displayName: event.target.value }, activeOption.publicId))} />{looksLikeMeasurementOnly(option.displayName) ? <small className="field-warning">Informe o alimento; quantidade e medida possuem campos próprios.</small> : null}</label><label><span>Quantidade</span><input aria-label="Quantidade da alternativa" disabled={option.unit.publicId === "unit_as_desired"} type="number" value={option.quantityMilli / 1000} onChange={(event) => mutate((current) => updateSubstitutionOption(current, meal.publicId, group.publicId, option.publicId, { quantityMilli: Math.max(1, Math.round(Number(event.target.value || 0) * 1000)) }, activeOption.publicId))} /></label><label><span>Medida</span><select value={option.unit.publicId} onChange={(event) => { const unit = NUTRIFLOW_UNITS.find((entry) => entry.publicId === event.target.value)!; mutate((current) => updateSubstitutionOption(current, meal.publicId, group.publicId, option.publicId, { unit, ...(unit.publicId === "unit_as_desired" ? { quantityMilli: 1000 } : {}) }, activeOption.publicId)); }}>{NUTRIFLOW_UNITS.map((unit) => <option key={unit.publicId} value={unit.publicId}>{unit.label}</option>)}</select></label><button type="button" aria-label={`Excluir ${option.displayName}`} onClick={() => mutate((current) => removeSubstitutionOption(current, meal.publicId, group.publicId, option.publicId, activeOption.publicId))}>×</button></div>)}</section>)}{activeOption.items.filter((item) => !(activeOption.substitutions ?? []).some((group) => group.mealItemPublicId === item.publicId)).map((item) => <button key={item.publicId} type="button" onClick={() => mutate((current) => addSubstitutionGroup(current, meal.publicId, item.publicId, activeOption.publicId))}>＋ Cadastrar troca para {item.displayName}</button>)}<datalist id="nutriflow-swap-labels"><option value="Trocar a proteína" /><option value="Trocar o carboidrato" /><option value="Trocar a fruta" /><option value="Trocar o acompanhamento" /></datalist></details> : null}
              <label className="nutriflow-instructions"><span>Orientações da refeição</span><textarea maxLength={2000} placeholder="Opcional: substituições, modo de preparo ou contexto clínico." value={meal.instructions ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { instructions: event.target.value || null }))} /></label></> : <button className="nutriflow-meal-collapsed-summary" type="button" onClick={() => toggleMeal(meal.publicId)}>{meal.items.length} alimento(s) · clique para expandir</button>}
            </article>})}
            <button className="nutriflow-add-meal" type="button" onClick={() => { const id = editorId("meal"); mutate((current) => addMeal(current, activeDay.publicId, id)); setSelectedMealId(id); trackProductivityAction("meal.add"); }}><span>＋</span><strong>Adicionar refeição</strong><small>Inclua horário, alimentos e orientações.</small></button>
          </div>
        </section> : <section className="nutriflow-no-days"><span>01</span><h2>Crie a primeira estratégia</h2><p>Organize as refeições pelo contexto clínico: rotina habitual, treino, descanso ou outra estratégia definida por você.</p><button type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); }}>Adicionar primeira estratégia</button></section>}
      </main>
      <div className="nutriflow-tools-rail">
        {tools.catalogEnabled ? <FoodLibraryPanel clientId={clientId} targetMealTitle={activeMeal?.title ?? null} onInsert={(food) => activeMealId && insertCatalogFood(food, activeMealId, activeMeal ? selectedMealOptionIds[activeMeal.publicId] ?? mealOptions(activeMeal)[0]?.publicId : undefined)} /> : null}
        {tools.recipesEnabled || tools.mealTemplatesEnabled ? <ReusableContentPanel clientId={clientId} activeMeal={activeMeal} templatesEnabled={tools.mealTemplatesEnabled} recipesEnabled={tools.recipesEnabled} onApplyTemplate={insertTemplate} onApplyRecipe={insertRecipe} onProductivityAction={trackProductivityAction} /> : null}
        <aside className="nutriflow-sidebar"><div><span>Paciente</span><strong>{patientName}</strong><small>Rascunho · versão {draft.versionNumber}.{draft.revision}</small></div><label><span>Observações gerais</span><textarea maxLength={4000} placeholder="Contexto clínico, estratégia e pontos importantes para revisão." value={draft.planNotes ?? ""} onChange={(event) => mutate((current) => ({ ...current, planNotes: event.target.value || null }))} /></label><section><span>Estrutura atual</span><dl><div><dt>Estratégias</dt><dd>{draft.content.days.length}</dd></div><div><dt>Refeições</dt><dd>{draft.content.meals.length}</dd></div><div><dt>Alimentos</dt><dd>{totalOptionItems}</dd></div></dl></section><button className="nutriflow-save-now" type="button" disabled={syncState === "saving" || syncState === "saved"} onClick={saveNow}>{syncState === "saving" ? "Salvando…" : "Salvar agora"}<small>Ctrl/⌘ + S</small></button><button className="nutriflow-publish" type="button" disabled={syncState !== "saved" || !allMealOptionsReady} onClick={publishDraft}>Publicar para o paciente<small>Versão imutável e auditada</small></button><p>{allMealOptionsReady ? "A publicação só ficará visível quando a flag do paciente for homologada." : "Preencha ao menos um alimento em cada opção cadastrada antes de publicar."}</p></aside>
      </div>
    </div>
  </div>;
}
