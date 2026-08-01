"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FoodCatalogItemV1 } from "../../../../../modules/nutriflow/contracts/v1/catalog.ts";
import type { FoodPlanDraftV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";
import { EditorLoadingSkeleton, EditorNotice, SyncIndicator, type EditorSyncState } from "./editor-components";
import FoodLibraryPanel from "./food-library-panel";
import {
  NUTRIFLOW_UNITS,
  addCatalogItem,
  addDay,
  addItem,
  addMeal,
  duplicateItem,
  duplicateMeal,
  editorId,
  moveDay,
  moveItem,
  moveMeal,
  removeDay,
  removeItem,
  removeMeal,
  updateItem,
  updateMeal,
} from "./editor-state";

type ApiEnvelope = { data?: FoodPlanDraftV1; errorCode?: string; message?: string };
type EditorTools = Readonly<{ catalogEnabled: boolean; recipesEnabled: boolean; mealTemplatesEnabled: boolean }>;

function formatSavedAt(value: string | null) {
  if (!value) return "Ainda não sincronizado";
  return `Salvo às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value))}`;
}
function recordClientMetric(metric: string, durationMs: number, extra: Record<string, number | string | boolean> = {}) {
  console.info("[nutriflow.client.metric]", JSON.stringify({ metric, durationMs: Math.round(durationMs), ...extra }));
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
  const latestDraft = useRef<FoodPlanDraftV1 | null>(null);
  const syncStateRef = useRef<EditorSyncState>("loading");
  const changeVersion = useRef(0);
  const saveInFlight = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNowRef = useRef<() => Promise<void>>(async () => undefined);
  const dirtyStartedAt = useRef<number | null>(null);
  const firstAutosaveRecorded = useRef(false);

  const transition = useCallback((next: EditorSyncState) => {
    syncStateRef.current = next;
    setSyncState(next);
  }, []);

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

  function insertCatalogFood(food: FoodCatalogItemV1, mealPublicId: string) {
    mutate((current) => addCatalogItem(current, mealPublicId, food));
    showNotice(`${food.name} adicionado à refeição.`);
  }

  async function createDraft() {
    transition("saving");
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/admin/nutriflow/drafts", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `create_${crypto.randomUUID()}` }, body: JSON.stringify({ clientId, title: `Plano alimentar — ${patientName}` }) });
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

  if (syncState === "loading") return <EditorLoadingSkeleton />;
  if (!draft) return <section className="nutriflow-empty"><p className="section-kicker">Primeiro plano estruturado</p><h1>Comece o plano de {patientName}</h1><p>Crie um rascunho seguro para organizar dias, refeições, alimentos e orientações em um único fluxo.</p><button type="button" onClick={createDraft}>Criar rascunho</button>{message ? <p role="alert">{message}</p> : null}</section>;

  const activeDayId = selectedDayId && draft.content.days.some((day) => day.publicId === selectedDayId) ? selectedDayId : draft.content.days[0]?.publicId ?? null;
  const activeDay = draft.content.days.find((day) => day.publicId === activeDayId);
  const meals = draft.content.meals.filter((meal) => meal.planDayPublicId === activeDayId).sort((left, right) => left.sortOrder - right.sortOrder);
  const activeMealId = selectedMealId && meals.some((meal) => meal.publicId === selectedMealId) ? selectedMealId : meals[0]?.publicId ?? null;
  const activeMeal = meals.find((meal) => meal.publicId === activeMealId) ?? null;
  const syncDetail = syncState === "saved" ? formatSavedAt(lastSavedAt) : syncState === "saving" ? "Gravação atômica em andamento" : syncState === "dirty" ? "Autosave em menos de 1 segundo" : "Autosave protegido por revisão";

  return <div className="nutriflow-editor">
    <header className="nutriflow-editor-header"><div><p className="section-kicker">Editor NutriFlow</p><input aria-label="Título do plano" maxLength={160} value={draft.title} onChange={(event) => mutate((current) => ({ ...current, title: event.target.value }))} /></div><SyncIndicator state={syncState} detail={syncDetail} /></header>
    {message ? <EditorNotice state={syncState} action={<button type="button" onClick={syncState === "conflict" ? loadDraft : saveNow}>{syncState === "conflict" ? "Recarregar versão" : "Tentar novamente"}</button>}>{message}</EditorNotice> : null}
    {notice ? <EditorNotice state="saved">{notice}</EditorNotice> : null}
    <div className={`nutriflow-editor-layout ${tools.catalogEnabled ? "has-library" : ""}`}>
      <main className="nutriflow-canvas">
        <nav className="nutriflow-days" aria-label="Dias do plano">
          {draft.content.days.map((day) => <button className={day.publicId === activeDayId ? "is-active" : ""} key={day.publicId} type="button" onClick={() => { setSelectedDayId(day.publicId); setSelectedMealId(draft.content.meals.find((meal) => meal.planDayPublicId === day.publicId)?.publicId ?? null); }}><span>{day.label}</span><small>{draft.content.meals.filter((meal) => meal.planDayPublicId === day.publicId).length} refeições</small></button>)}
          <button className="is-add" type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); setSelectedMealId(null); }}>＋ Adicionar dia</button>
        </nav>
        {activeDay ? <section className="nutriflow-day-panel">
          <header><div><label htmlFor="day-label">Nome do dia</label><input id="day-label" maxLength={120} value={activeDay.label} onChange={(event) => mutate((current) => ({ ...current, content: { ...current.content, days: current.content.days.map((day) => day.publicId === activeDay.publicId ? { ...day, label: event.target.value } : day) } }))} /></div><div className="nutriflow-icon-actions"><button type="button" title="Mover dia para a esquerda" aria-label="Mover dia para a esquerda" disabled={activeDay.sortOrder === 0} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, -1))}>←</button><button type="button" title="Mover dia para a direita" aria-label="Mover dia para a direita" disabled={activeDay.sortOrder === draft.content.days.length - 1} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, 1))}>→</button><button className="is-danger" type="button" onClick={() => { mutate((current) => removeDay(current, activeDay.publicId)); setSelectedDayId(draft.content.days.find((day) => day.publicId !== activeDay.publicId)?.publicId ?? null); setSelectedMealId(null); }}>Excluir dia</button></div></header>
          <div className="nutriflow-meals">
            {meals.map((meal, mealIndex) => <article className={`nutriflow-meal ${meal.publicId === activeMealId ? "is-selected" : ""}`} key={meal.publicId} onClick={() => setSelectedMealId(meal.publicId)} onFocusCapture={() => setSelectedMealId(meal.publicId)}>
              <header><span className="nutriflow-meal-index">{String(mealIndex + 1).padStart(2, "0")}</span><div className="nutriflow-meal-title"><input aria-label="Nome da refeição" maxLength={120} value={meal.title} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { title: event.target.value }))} /><input aria-label="Horário da refeição" type="time" value={meal.scheduledTime ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { scheduledTime: event.target.value || null }))} /></div><div className="nutriflow-icon-actions"><button type="button" title="Duplicar refeição" aria-label="Duplicar refeição" onClick={() => { const id = editorId("meal"); mutate((current) => duplicateMeal(current, meal.publicId, { meal: id, items: meal.items.map(() => editorId("item")) })); setSelectedMealId(id); }}>⧉</button><button type="button" aria-label="Mover refeição para cima" disabled={mealIndex === 0} onClick={() => mutate((current) => moveMeal(current, meal.publicId, -1))}>↑</button><button type="button" aria-label="Mover refeição para baixo" disabled={mealIndex === meals.length - 1} onClick={() => mutate((current) => moveMeal(current, meal.publicId, 1))}>↓</button><button className="is-danger" type="button" onClick={() => { mutate((current) => removeMeal(current, meal.publicId)); setSelectedMealId(null); }}>Excluir</button></div></header>
              <div className="nutriflow-items">
                {meal.items.map((item, itemIndex) => <div className="nutriflow-item" key={item.publicId}>
                  <div className="nutriflow-item-main">
                    <label><span>Alimento {item.source.type === "food" ? <b>Biblioteca v{item.source.revisionNumber}</b> : null}</span><input maxLength={200} value={item.displayName} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { displayName: event.target.value }))} /></label>
                    <label><span>Quantidade</span><input inputMode="decimal" min="0.001" step="0.001" type="number" value={item.quantityMilli / 1000} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { quantityMilli: Math.max(1, Math.round(Number(event.target.value || 0) * 1000)) }))} /></label>
                    <label><span>Medida</span><select value={item.unit.publicId} onChange={(event) => { const unit = NUTRIFLOW_UNITS.find((option) => option.publicId === event.target.value)!; mutate((current) => updateItem(current, meal.publicId, item.publicId, { unit })); }}>{NUTRIFLOW_UNITS.map((unit) => <option key={unit.publicId} value={unit.publicId}>{unit.label}</option>)}</select></label>
                    <label className="is-preparation"><span>Preparo ou detalhe</span><input maxLength={500} placeholder="Ex.: grelhado, sem açúcar" value={item.preparation ?? ""} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { preparation: event.target.value || null }))} /></label>
                    <div className="nutriflow-item-actions"><button type="button" aria-label="Mover alimento para cima" disabled={itemIndex === 0} onClick={() => mutate((current) => moveItem(current, meal.publicId, item.publicId, -1))}>↑</button><button type="button" aria-label="Mover alimento para baixo" disabled={itemIndex === meal.items.length - 1} onClick={() => mutate((current) => moveItem(current, meal.publicId, item.publicId, 1))}>↓</button><button type="button" title="Duplicar alimento" aria-label="Duplicar alimento" onClick={() => mutate((current) => duplicateItem(current, meal.publicId, item.publicId))}>⧉</button><button className="is-danger" type="button" aria-label={`Excluir ${item.displayName}`} onClick={() => mutate((current) => removeItem(current, meal.publicId, item.publicId))}>×</button></div>
                  </div>
                  <details className="nutriflow-item-notes"><summary>Observação opcional do alimento</summary><label><span>Orientação ou contexto</span><input maxLength={1000} placeholder="Ex.: consumir antes do treino" value={item.notes ?? ""} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { notes: event.target.value || null }))} /></label></details>
                </div>)}
                <button className="nutriflow-add-item" type="button" onClick={() => mutate((current) => addItem(current, meal.publicId))}>＋ Adicionar alimento manualmente</button>
              </div>
              <label className="nutriflow-instructions"><span>Orientações da refeição</span><textarea maxLength={2000} placeholder="Opcional: substituições, modo de preparo ou contexto clínico." value={meal.instructions ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { instructions: event.target.value || null }))} /></label>
            </article>)}
            <button className="nutriflow-add-meal" type="button" onClick={() => { const id = editorId("meal"); mutate((current) => addMeal(current, activeDay.publicId, id)); setSelectedMealId(id); }}><span>＋</span><strong>Adicionar refeição</strong><small>Inclua horário, alimentos e orientações.</small></button>
          </div>
        </section> : <section className="nutriflow-no-days"><span>01</span><h2>Organize o plano por dias</h2><p>Adicione o primeiro dia para começar a montar as refeições.</p><button type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); }}>Adicionar primeiro dia</button></section>}
      </main>
      <div className="nutriflow-tools-rail">
        {tools.catalogEnabled ? <FoodLibraryPanel clientId={clientId} targetMealTitle={activeMeal?.title ?? null} onInsert={(food) => activeMealId && insertCatalogFood(food, activeMealId)} /> : null}
        <aside className="nutriflow-sidebar"><div><span>Paciente</span><strong>{patientName}</strong><small>Rascunho · versão {draft.versionNumber}.{draft.revision}</small></div><label><span>Observações gerais</span><textarea maxLength={4000} placeholder="Contexto clínico, estratégia e pontos importantes para revisão." value={draft.planNotes ?? ""} onChange={(event) => mutate((current) => ({ ...current, planNotes: event.target.value || null }))} /></label><section><span>Estrutura atual</span><dl><div><dt>Dias</dt><dd>{draft.content.days.length}</dd></div><div><dt>Refeições</dt><dd>{draft.content.meals.length}</dd></div><div><dt>Alimentos</dt><dd>{draft.content.meals.reduce((total, meal) => total + meal.items.length, 0)}</dd></div></dl></section><button className="nutriflow-save-now" type="button" disabled={syncState === "saving" || syncState === "saved"} onClick={saveNow}>{syncState === "saving" ? "Salvando…" : "Salvar agora"}<small>Ctrl/⌘ + S</small></button><p>O plano ainda não está visível ao paciente.</p></aside>
      </div>
    </div>
  </div>;
}
