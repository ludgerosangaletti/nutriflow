"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FoodPlanDraftV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";
import { NUTRIFLOW_UNITS, addDay, addItem, addMeal, editorId, moveDay, moveMeal, removeDay, removeItem, removeMeal, updateItem, updateMeal } from "./editor-state";

type SyncState = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict";
type ApiEnvelope = { data?: FoodPlanDraftV1; errorCode?: string; message?: string };

function formatSavedAt(value: string | null) {
  if (!value) return "Ainda não sincronizado";
  return `Salvo às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))}`;
}

export default function NutriFlowEditor({ clientId, patientName }: { clientId: number; patientName: string }) {
  const [draft, setDraft] = useState<FoodPlanDraftV1 | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [message, setMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const latestDraft = useRef<FoodPlanDraftV1 | null>(null);
  const changeVersion = useRef(0);
  const saveInFlight = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { latestDraft.current = draft; }, [draft]);

  const loadDraft = useCallback(async () => {
    setSyncState("loading");
    setMessage("");
    const response = await fetch(`/api/admin/nutriflow/drafts?clientId=${clientId}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as ApiEnvelope;
    if (response.status === 404 && result.errorCode === "NF_NOT_FOUND") {
      setDraft(null);
      setSyncState("saved");
      return;
    }
    if (!response.ok || !result.data) {
      setSyncState("error");
      setMessage(result.message || "Não foi possível carregar o editor.");
      return;
    }
    setDraft(result.data);
    setSelectedDayId((current) => current && result.data!.content.days.some((day) => day.publicId === current) ? current : result.data!.content.days[0]?.publicId ?? null);
    setLastSavedAt(result.data.updatedAt);
    setSyncState("saved");
  }, [clientId]);

  useEffect(() => { void loadDraft(); }, [loadDraft]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const saveNow = useCallback(async () => {
    const snapshot = latestDraft.current;
    if (!snapshot || saveInFlight.current || syncState === "conflict") return;
    if (!snapshot.title.trim()) {
      setSyncState("error");
      setMessage("Informe um título antes de sincronizar o plano.");
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveInFlight.current = true;
    const capturedVersion = changeVersion.current;
    setSyncState("saving");
    setMessage("");
    const correlation = `corr_${crypto.randomUUID()}`;
    const response = await fetch("/api/admin/nutriflow/drafts", {
      method: "PATCH",
      headers: { "content-type": "application/json", "idempotency-key": `save_${crypto.randomUUID()}`, "x-correlation-id": correlation },
      body: JSON.stringify({ clientId, command: { apiVersion: "v1", planPublicId: snapshot.planPublicId, planVersionPublicId: snapshot.publicId, expectedRevision: snapshot.revision, title: snapshot.title, planNotes: snapshot.planNotes, content: snapshot.content, correlationId: correlation } }),
    });
    const result = await response.json().catch(() => ({})) as ApiEnvelope;
    saveInFlight.current = false;
    if (response.status === 409) {
      setSyncState("conflict");
      setMessage("Este plano foi atualizado em outra sessão. Recarregue para continuar sem sobrescrever alterações.");
      return;
    }
    if (!response.ok || !result.data) {
      setSyncState("error");
      setMessage(result.message || "Não foi possível sincronizar. Suas alterações continuam nesta tela.");
      return;
    }
    setLastSavedAt(result.data.updatedAt);
    setDraft((current) => current ? { ...current, revision: result.data!.revision, updatedAt: result.data!.updatedAt } : result.data!);
    if (changeVersion.current === capturedVersion) {
      setSyncState("saved");
    } else {
      setSyncState("dirty");
      saveTimer.current = setTimeout(() => { void saveNow(); }, 350);
    }
  }, [clientId, syncState]);

  function mutate(updater: (current: FoodPlanDraftV1) => FoodPlanDraftV1) {
    setDraft((current) => current ? updater(current) : current);
    changeVersion.current += 1;
    setSyncState("dirty");
    setMessage("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveNow(); }, 900);
  }

  async function createDraft() {
    setSyncState("saving");
    const response = await fetch("/api/admin/nutriflow/drafts", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `create_${crypto.randomUUID()}` }, body: JSON.stringify({ clientId, title: `Plano alimentar — ${patientName}` }) });
    const result = await response.json().catch(() => ({})) as ApiEnvelope;
    if (!response.ok || !result.data) {
      setSyncState("error");
      setMessage(result.message || "Não foi possível criar o rascunho.");
      return;
    }
    setDraft(result.data);
    setLastSavedAt(result.data.updatedAt);
    setSyncState("saved");
  }

  if (syncState === "loading") return <section className="nutriflow-loading" aria-live="polite"><span /><strong>Preparando o editor NutriFlow…</strong></section>;
  if (!draft) return <section className="nutriflow-empty"><p className="section-kicker">Primeiro plano estruturado</p><h1>Comece o plano de {patientName}</h1><p>Crie um rascunho seguro para organizar dias, refeições, alimentos e orientações em um único fluxo.</p><button type="button" onClick={createDraft}>Criar rascunho</button>{message ? <p role="alert">{message}</p> : null}</section>;

  const activeDayId = selectedDayId && draft.content.days.some((day) => day.publicId === selectedDayId) ? selectedDayId : draft.content.days[0]?.publicId ?? null;
  const activeDay = draft.content.days.find((day) => day.publicId === activeDayId);
  const meals = draft.content.meals.filter((meal) => meal.planDayPublicId === activeDayId).sort((a, b) => a.sortOrder - b.sortOrder);

  return <div className="nutriflow-editor">
    <header className="nutriflow-editor-header">
      <div><p className="section-kicker">Editor NutriFlow</p><input aria-label="Título do plano" maxLength={160} value={draft.title} onChange={(event) => mutate((current) => ({ ...current, title: event.target.value }))} /></div>
      <div className={`nutriflow-sync is-${syncState}`} aria-live="polite"><span aria-hidden="true" /> <div><strong>{syncState === "saving" ? "Salvando…" : syncState === "dirty" ? "Alterações pendentes" : syncState === "error" ? "Falha ao sincronizar" : syncState === "conflict" ? "Conflito de edição" : "Tudo sincronizado"}</strong><small>{syncState === "saved" ? formatSavedAt(lastSavedAt) : "Autosave protegido por revisão"}</small></div></div>
    </header>
    {message ? <div className={`nutriflow-message is-${syncState}`} role="alert"><span>{message}</span><button type="button" onClick={syncState === "conflict" ? loadDraft : saveNow}>{syncState === "conflict" ? "Recarregar versão" : "Tentar novamente"}</button></div> : null}
    <div className="nutriflow-editor-layout">
      <main className="nutriflow-canvas">
        <nav className="nutriflow-days" aria-label="Dias do plano">
          {draft.content.days.map((day, index) => <button className={day.publicId === activeDayId ? "is-active" : ""} key={day.publicId} type="button" onClick={() => setSelectedDayId(day.publicId)}><span>{day.label}</span><small>{draft.content.meals.filter((meal) => meal.planDayPublicId === day.publicId).length} refeições</small></button>)}
          <button className="is-add" type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); }}>＋ Adicionar dia</button>
        </nav>
        {activeDay ? <section className="nutriflow-day-panel">
          <header><div><label htmlFor="day-label">Nome do dia</label><input id="day-label" maxLength={120} value={activeDay.label} onChange={(event) => mutate((current) => ({ ...current, content: { ...current.content, days: current.content.days.map((day) => day.publicId === activeDay.publicId ? { ...day, label: event.target.value } : day) } }))} /></div><div className="nutriflow-icon-actions"><button type="button" aria-label="Mover dia para a esquerda" disabled={activeDay.sortOrder === 0} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, -1))}>←</button><button type="button" aria-label="Mover dia para a direita" disabled={activeDay.sortOrder === draft.content.days.length - 1} onClick={() => mutate((current) => moveDay(current, activeDay.publicId, 1))}>→</button><button className="is-danger" type="button" onClick={() => { mutate((current) => removeDay(current, activeDay.publicId)); setSelectedDayId(draft.content.days.find((day) => day.publicId !== activeDay.publicId)?.publicId ?? null); }}>Excluir dia</button></div></header>
          <div className="nutriflow-meals">
            {meals.map((meal, mealIndex) => <article className="nutriflow-meal" key={meal.publicId}>
              <header><span className="nutriflow-meal-index">{String(mealIndex + 1).padStart(2, "0")}</span><div className="nutriflow-meal-title"><input aria-label="Nome da refeição" maxLength={120} value={meal.title} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { title: event.target.value }))} /><input aria-label="Horário da refeição" type="time" value={meal.scheduledTime ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { scheduledTime: event.target.value || null }))} /></div><div className="nutriflow-icon-actions"><button type="button" aria-label="Mover refeição para cima" disabled={mealIndex === 0} onClick={() => mutate((current) => moveMeal(current, meal.publicId, -1))}>↑</button><button type="button" aria-label="Mover refeição para baixo" disabled={mealIndex === meals.length - 1} onClick={() => mutate((current) => moveMeal(current, meal.publicId, 1))}>↓</button><button className="is-danger" type="button" onClick={() => mutate((current) => removeMeal(current, meal.publicId))}>Excluir</button></div></header>
              <div className="nutriflow-items">
                {meal.items.map((item) => <div className="nutriflow-item" key={item.publicId}>
                  <label><span>Alimento</span><input maxLength={200} value={item.displayName} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { displayName: event.target.value }))} /></label>
                  <label><span>Quantidade</span><input inputMode="decimal" min="0.001" step="0.001" type="number" value={item.quantityMilli / 1000} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { quantityMilli: Math.max(1, Math.round(Number(event.target.value || 0) * 1000)) }))} /></label>
                  <label><span>Medida</span><select value={item.unit.publicId} onChange={(event) => { const unit = NUTRIFLOW_UNITS.find((option) => option.publicId === event.target.value)!; mutate((current) => updateItem(current, meal.publicId, item.publicId, { unit })); }}>{NUTRIFLOW_UNITS.map((unit) => <option key={unit.publicId} value={unit.publicId}>{unit.label}</option>)}</select></label>
                  <label className="is-preparation"><span>Preparo ou detalhe</span><input maxLength={500} placeholder="Ex.: grelhado, sem açúcar" value={item.preparation ?? ""} onChange={(event) => mutate((current) => updateItem(current, meal.publicId, item.publicId, { preparation: event.target.value || null }))} /></label>
                  <button className="nutriflow-remove-item" type="button" aria-label={`Excluir ${item.displayName}`} onClick={() => mutate((current) => removeItem(current, meal.publicId, item.publicId))}>×</button>
                </div>)}
                <button className="nutriflow-add-item" type="button" onClick={() => mutate((current) => addItem(current, meal.publicId))}>＋ Adicionar alimento</button>
              </div>
              <label className="nutriflow-instructions"><span>Orientações da refeição</span><textarea maxLength={2000} placeholder="Opcional: substituições, modo de preparo ou contexto clínico." value={meal.instructions ?? ""} onChange={(event) => mutate((current) => updateMeal(current, meal.publicId, { instructions: event.target.value || null }))} /></label>
            </article>)}
            <button className="nutriflow-add-meal" type="button" onClick={() => mutate((current) => addMeal(current, activeDay.publicId))}><span>＋</span><strong>Adicionar refeição</strong><small>Inclua horário, alimentos e orientações.</small></button>
          </div>
        </section> : <section className="nutriflow-no-days"><span>01</span><h2>Organize o plano por dias</h2><p>Adicione o primeiro dia para começar a montar as refeições.</p><button type="button" onClick={() => { const id = editorId("day"); mutate((current) => addDay(current, id)); setSelectedDayId(id); }}>Adicionar primeiro dia</button></section>}
      </main>
      <aside className="nutriflow-sidebar"><div><span>Paciente</span><strong>{patientName}</strong><small>Rascunho · versão {draft.versionNumber}.{draft.revision}</small></div><label><span>Observações gerais</span><textarea maxLength={4000} placeholder="Contexto clínico, estratégia e pontos importantes para revisão." value={draft.planNotes ?? ""} onChange={(event) => mutate((current) => ({ ...current, planNotes: event.target.value || null }))} /></label><section><span>Estrutura atual</span><dl><div><dt>Dias</dt><dd>{draft.content.days.length}</dd></div><div><dt>Refeições</dt><dd>{draft.content.meals.length}</dd></div><div><dt>Alimentos</dt><dd>{draft.content.meals.reduce((total, meal) => total + meal.items.length, 0)}</dd></div></dl></section><button className="nutriflow-save-now" type="button" disabled={syncState === "saving" || syncState === "saved"} onClick={saveNow}>{syncState === "saving" ? "Salvando…" : "Salvar agora"}</button><p>O plano ainda não está visível ao paciente.</p></aside>
    </div>
  </div>;
}
