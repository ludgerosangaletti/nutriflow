"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TRAINING_EXERCISE_LIBRARY_MAX_RESULTS, type TrainingEditorWorkspaceV1, type TrainingExerciseLibraryItemV1, type TrainingRoutineContentV1, type TrainingWeekday } from "../../../../../modules/nutriflow/contracts/v1/training.ts";
import { addMuscleGroup, addTrainingExercise, emptyTrainingContent, groupsForDay, moveTrainingExercise, removeMuscleGroup, removeTrainingExercise, renameMuscleGroup, TRAINING_DAYS, updateTrainingExercise } from "./training-editor-state";

type Envelope<T> = { data?: T; errorCode?: string; message?: string };
const muscleGroups = [
  { label: "Todos", value: "" },
  { label: "Peito", value: "peito" },
  { label: "Costas", value: "costas" },
  { label: "Ombros", value: "ombros" },
  { label: "Bíceps", value: "biceps" },
  { label: "Tríceps", value: "triceps" },
  { label: "Quadríceps", value: "quadriceps" },
  { label: "Posterior", value: "posterior_coxa" },
  { label: "Glúteos", value: "gluteos" },
  { label: "Panturrilhas", value: "panturrilhas" },
  { label: "Core", value: "core" },
] as const;

function requestHeaders() { return { "content-type": "application/json", "x-correlation-id": `corr_${crypto.randomUUID()}` }; }
function numeric(value: string) { return value === "" ? null : Number(value); }
function daySummary(content: TrainingRoutineContentV1, weekday: TrainingWeekday) {
  const groups = groupsForDay(content, weekday);
  if (!groups.length) return "Descanso";
  return groups.map((group) => group.name).filter(Boolean).join(" + ");
}

export default function TrainingEditor({ clientId, patientName }: Readonly<{ clientId: number; patientName: string }>) {
  const [workspace, setWorkspace] = useState<TrainingEditorWorkspaceV1 | null>(null);
  const [activeDay, setActiveDay] = useState<TrainingWeekday>("mon");
  const [title, setTitle] = useState("Treino semanal");
  const [content, setContent] = useState<TrainingRoutineContentV1>(emptyTrainingContent());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [library, setLibrary] = useState<readonly TrainingExerciseLibraryItemV1[]>([]);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryGroupId, setLibraryGroupId] = useState<string | null>(null);
  const [mediaExercise, setMediaExercise] = useState<TrainingExerciseLibraryItemV1 | null>(null);
  const [mediaSaving, setMediaSaving] = useState(false);
  const libraryRequestId = useRef(0);

  const syncWorkspace = useCallback((next: TrainingEditorWorkspaceV1) => {
    setWorkspace(next);
    if (next.draft) { setTitle(next.draft.title); setContent(next.draft.content); return; }
    if (next.publication) setContent(next.publication.content);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/nutriflow/training?clientId=${clientId}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
    if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível abrir o Treino.");
    syncWorkspace(result.data);
  }, [clientId, syncWorkspace]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível abrir o Treino.")); }, [load]);

  async function action(actionName: "entitlement" | "create-draft" | "publish", command?: Record<string, unknown>) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/nutriflow/training", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ action: actionName, clientId, patientName, command }) });
      const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível concluir a ação.");
      syncWorkspace(result.data);
      if (actionName === "publish") setMessage("Treino publicado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação."); }
    finally { setSaving(false); }
  }

  async function save(showMessage = true): Promise<TrainingEditorWorkspaceV1 | null> {
    if (!workspace?.draft) return null;
    setSaving(true); setMessage("");
    try {
      const draft = workspace.draft;
      const response = await fetch("/api/admin/nutriflow/training", { method: "PATCH", headers: requestHeaders(), body: JSON.stringify({ clientId, command: { routinePublicId: draft.routinePublicId, routineVersionPublicId: draft.publicId, expectedRevision: draft.revision, title, content } }) });
      const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
      if (!response.ok || !result.data) throw new Error(result.message || "Revise os campos obrigatórios da prescrição.");
      syncWorkspace(result.data); if (showMessage) setMessage("Alterações salvas."); return result.data;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o treino."); return null; }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!workspace?.draft || !window.confirm("Publicar este treino para o paciente?")) return;
    const current = isDirty ? await save(false) : workspace;
    const draft = current?.draft;
    if (!draft) return;
    await action("publish", { routinePublicId: draft.routinePublicId, routineVersionPublicId: draft.publicId, expectedRevision: draft.revision });
  }

  async function openLibrary(groupId: string) {
    setLibraryGroupId(groupId); setLibrary([]); setLibraryHasMore(false); setSearch(""); setFilter("");
    await searchLibrary("", "", false);
  }

  async function searchLibrary(query = search, muscleGroup = filter, append = false) {
    if (libraryLoading && append) return;
    const offset = append ? library.length : 0;
    const requestId = ++libraryRequestId.current;
    setLibraryLoading(true);
    try {
      const parameters = new URLSearchParams({ clientId: String(clientId), query, limit: String(TRAINING_EXERCISE_LIBRARY_MAX_RESULTS), offset: String(offset) });
      if (muscleGroup) parameters.set("muscleGroup", muscleGroup);
      const response = await fetch(`/api/admin/nutriflow/training/exercises?${parameters.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as Envelope<{ items: readonly TrainingExerciseLibraryItemV1[]; hasMore: boolean }>;
      if (requestId !== libraryRequestId.current) return;
      if (!response.ok || !result.data) { setMessage(result.message || "Não foi possível consultar a biblioteca."); return; }
      setLibrary((current) => append ? [...current, ...result.data!.items] : result.data!.items);
      setLibraryHasMore(result.data.hasMore);
    } catch {
      if (requestId === libraryRequestId.current) setMessage("Não foi possível consultar a biblioteca.");
    } finally {
      if (requestId === libraryRequestId.current) setLibraryLoading(false);
    }
  }

  async function submitMedia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mediaExercise) return;
    setMediaSaving(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget); form.set("clientId", String(clientId));
      const response = await fetch(`/api/admin/nutriflow/training/exercises/${encodeURIComponent(mediaExercise.publicId)}/media`, { method: "POST", headers: { "x-correlation-id": `corr_${crypto.randomUUID()}` }, body: form });
      const result = await response.json().catch(() => ({})) as Envelope<unknown>;
      if (!response.ok) throw new Error(result.message || "Não foi possível associar a mídia.");
      setMessage("Mídia associada. Exercícios publicados permanecem inalterados."); setMediaExercise(null); await searchLibrary();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível associar a mídia."); }
    finally { setMediaSaving(false); }
  }

  async function removeMedia() {
    if (!mediaExercise) return;
    setMediaSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/nutriflow/training/exercises/${encodeURIComponent(mediaExercise.publicId)}/media`, { method: "DELETE", headers: requestHeaders(), body: JSON.stringify({ clientId }) });
      const result = await response.json().catch(() => ({})) as Envelope<unknown>;
      if (!response.ok) throw new Error(result.message || "Não foi possível remover a mídia.");
      setMessage("Associação de mídia removida."); setMediaExercise(null); await searchLibrary();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover a mídia."); }
    finally { setMediaSaving(false); }
  }

  const isEditing = Boolean(workspace?.draft);
  const isDirty = useMemo(() => Boolean(workspace?.draft && (title !== workspace.draft.title || JSON.stringify(content) !== JSON.stringify(workspace.draft.content))), [content, title, workspace]);

  if (!workspace) return <section className="training-editor training-loading" aria-busy="true"><div className="training-skeleton training-skeleton-heading" /><div className="training-skeleton training-skeleton-days" /><div className="training-skeleton training-skeleton-panel" />{message ? <p role="alert">{message}</p> : null}</section>;
  const groups = groupsForDay(content, activeDay);
  const activePublication = workspace.publication;

  return <section className={`training-editor ${isEditing ? "is-editing" : "is-viewing"}`}>
    <header className="training-editor-header">
      <div className="training-heading"><p className="section-kicker">NutriFlow Training</p><h1>{isEditing ? title : "Treino semanal"}</h1><p><strong>{patientName}</strong><span aria-hidden="true"> · </span>{activePublication ? `Publicado • Versão ${activePublication.versionNumber}` : isEditing ? "Novo treino" : "Sem treino publicado"}</p></div>
      <div className="training-primary-actions">
        {workspace.entitlement.active && !isEditing ? <button className="training-edit-button" type="button" disabled={saving} onClick={() => void action("create-draft")}>{activePublication ? "Editar treino" : "Montar treino"}</button> : null}
        {isEditing ? <><span className={`training-save-state ${isDirty ? "is-dirty" : ""}`}>{saving ? "Salvando…" : isDirty ? "Alterações não salvas" : "Salvo"}</span><button type="button" disabled={saving || !isDirty} onClick={() => void save()}>Salvar</button><button className="is-publish" type="button" disabled={saving || content.days.length === 0} onClick={() => void publish()}>Publicar</button></> : null}
        <details className="training-admin-menu"><summary aria-label="Mais opções">•••</summary><div><small>Acesso do paciente</small><strong>{workspace.entitlement.active ? "Training ativo" : "Training inativo"}</strong><button type="button" disabled={saving} onClick={() => void action("entitlement", { active: !workspace.entitlement.active, reason: workspace.entitlement.active ? "Revogado pelo administrador" : "Ativado pelo administrador" })}>{workspace.entitlement.active ? "Revogar acesso" : "Ativar Training"}</button></div></details>
      </div>
    </header>

    {message ? <p className="training-message" role="status">{message}</p> : null}
    {!workspace.entitlement.active ? <section className="training-empty"><span className="training-empty-icon">○</span><h2>Training desativado</h2><p>Ative o acesso nas opções para montar a rotina. Todo o histórico será preservado.</p></section> : null}
    {workspace.entitlement.active && (activePublication || isEditing) ? <>
      {isEditing ? <label className="training-title"><span>Nome do treino</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Treino semanal" /></label> : null}
      <nav className="training-days" aria-label="Dias da semana">{TRAINING_DAYS.map((day) => <button key={day.key} type="button" className={activeDay === day.key ? "is-active" : ""} onClick={() => setActiveDay(day.key)}><strong>{day.label}</strong><small>{daySummary(content, day.key)}</small></button>)}</nav>
      <div className="training-day-panel">
        <header><div><p className="section-kicker">{TRAINING_DAYS.find((day) => day.key === activeDay)?.label}</p><h2>{groups.length ? daySummary(content, activeDay) : "Dia de descanso"}</h2><small>{groups.reduce((total, group) => total + group.exercises.length, 0)} exercícios</small></div>{isEditing ? <button type="button" onClick={() => setContent((current) => addMuscleGroup(current, activeDay, "Peito"))}>+ Adicionar grupo</button> : null}</header>
        {!groups.length ? <div className="training-rest"><span>☾</span><strong>Descanso</strong><small>{isEditing ? "Adicione um grupo muscular para prescrever este dia." : "Nenhum exercício prescrito para este dia."}</small></div> : null}
        <div className="training-groups">{groups.map((group) => <article key={group.publicId} className="training-group">
          <header>{isEditing ? <input aria-label="Grupo muscular" value={group.name} onChange={(event) => setContent((current) => renameMuscleGroup(current, activeDay, group.publicId, event.target.value))} list="training-muscle-groups" /> : <h3>{group.name}</h3>}<span>{group.exercises.length} {group.exercises.length === 1 ? "exercício" : "exercícios"}</span>{isEditing ? <button type="button" className="is-remove training-icon-button" title="Remover grupo" aria-label={`Remover grupo ${group.name}`} onClick={() => setContent((current) => removeMuscleGroup(current, activeDay, group.publicId))}>×</button> : null}</header>
          <div className="training-exercises">{group.exercises.map((exercise, index) => <article key={exercise.publicId} className="training-exercise">
            <div className="training-exercise-name"><span className="training-exercise-index">{index + 1}</span><div><strong>{exercise.exercise.name}</strong><small>{exercise.exercise.primaryMuscleGroup}</small></div></div>
            {isEditing ? <div className="training-prescription">
              <label className="is-sets"><span>Séries</span><input aria-label={`Séries de ${exercise.exercise.name}`} inputMode="numeric" value={exercise.prescription.sets ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { sets: numeric(event.target.value) }))} /></label><b aria-hidden="true">×</b>
              <label><span>Repetições</span><div className="training-range"><input aria-label={`Repetições mínimas de ${exercise.exercise.name}`} inputMode="numeric" value={exercise.prescription.repetitions?.min ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { repetitions: { min: numeric(event.target.value) ?? 0, max: exercise.prescription.repetitions?.max ?? 0 }, durationSeconds: null }))} /><i>–</i><input aria-label={`Repetições máximas de ${exercise.exercise.name}`} inputMode="numeric" value={exercise.prescription.repetitions?.max ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { repetitions: { min: exercise.prescription.repetitions?.min ?? 0, max: numeric(event.target.value) ?? 0 }, durationSeconds: null }))} /></div></label>
              <label className="is-time"><span>ou tempo</span><div><input aria-label={`Tempo de ${exercise.exercise.name}`} inputMode="numeric" value={exercise.prescription.durationSeconds ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { durationSeconds: numeric(event.target.value), repetitions: null }))} /><em>s</em></div></label>
              <label className="is-rest"><span>Descanso</span><div><input aria-label={`Descanso de ${exercise.exercise.name}`} inputMode="numeric" value={exercise.prescription.restSeconds ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { restSeconds: numeric(event.target.value) }))} /><em>s</em></div></label>
              <label className="is-note"><span>Observação</span><input aria-label={`Observação de ${exercise.exercise.name}`} value={exercise.prescription.notes ?? ""} placeholder="Opcional" onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { notes: event.target.value || null }))} /></label>
            </div> : <div className="training-prescription-summary"><strong>{exercise.prescription.sets ?? "–"} × {exercise.prescription.durationSeconds ? `${exercise.prescription.durationSeconds} s` : exercise.prescription.repetitions ? `${exercise.prescription.repetitions.min}–${exercise.prescription.repetitions.max}` : "–"}</strong><span>{exercise.prescription.restSeconds ? `${exercise.prescription.restSeconds} s descanso` : "Sem descanso"}</span>{exercise.prescription.notes ? <small>{exercise.prescription.notes}</small> : null}</div>}
            {isEditing ? <div className="training-order"><button type="button" title="Mover para cima" aria-label={`Mover ${exercise.exercise.name} para cima`} disabled={index === 0} onClick={() => setContent((current) => moveTrainingExercise(current, activeDay, group.publicId, exercise.publicId, -1))}>↑</button><button type="button" title="Mover para baixo" aria-label={`Mover ${exercise.exercise.name} para baixo`} disabled={index === group.exercises.length - 1} onClick={() => setContent((current) => moveTrainingExercise(current, activeDay, group.publicId, exercise.publicId, 1))}>↓</button><button type="button" title="Remover exercício" aria-label={`Remover ${exercise.exercise.name}`} className="is-remove" onClick={() => setContent((current) => removeTrainingExercise(current, activeDay, group.publicId, exercise.publicId))}>×</button></div> : null}
          </article>)}</div>
          {isEditing ? <button type="button" className="training-add-exercise" onClick={() => void openLibrary(group.publicId)}>+ Adicionar exercício</button> : null}
        </article>)}</div>
      </div>
      <datalist id="training-muscle-groups">{muscleGroups.slice(1).map((group) => <option key={group.value} value={group.label} />)}</datalist>
    </> : null}

    {libraryGroupId ? <div className="training-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryGroupId(null); }}><section className="training-library" role="dialog" aria-modal="true" aria-label="Biblioteca de exercícios">
      <header><div><p className="section-kicker">Adicionar exercício</p><h2>Biblioteca de exercícios</h2></div><button className="training-icon-button" type="button" aria-label="Fechar biblioteca" onClick={() => { setLibraryGroupId(null); setMediaExercise(null); }}>×</button></header>
      <form className="training-library-search" onSubmit={(event) => { event.preventDefault(); void searchLibrary(); }}><span aria-hidden="true">⌕</span><input autoFocus placeholder="Buscar por nome do exercício" value={search} onChange={(event) => { setSearch(event.target.value); void searchLibrary(event.target.value); }} /><button type="submit">Buscar</button></form>
      <div className="training-library-filters" aria-label="Filtrar por grupamento">{muscleGroups.map((group) => <button key={group.value || "all"} type="button" className={filter === group.value ? "is-active" : ""} onClick={() => { setFilter(group.value); void searchLibrary(search, group.value, false); }}>{group.label}</button>)}</div>
      <ul>{library.map((item) => <li key={item.publicId}><span className={`training-library-thumb ${item.media ? "has-media" : ""}`}>{item.media ? "▶" : item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.primaryMuscleGroup}{item.media ? " · demonstração disponível" : ""}</small></div><span className="training-library-actions">{item.scope === "organization" ? <button className="is-secondary" type="button" onClick={() => setMediaExercise(item)}>Mídia</button> : null}<button type="button" onClick={() => { setContent((current) => addTrainingExercise(current, activeDay, libraryGroupId, item)); setMessage(`${item.name} adicionado.`); }}>Adicionar</button></span></li>)}</ul>
      {!library.length ? <p className="training-library-empty">Nenhum exercício encontrado.</p> : null}
      {libraryHasMore ? <button className="training-library-more" type="button" disabled={libraryLoading} onClick={() => void searchLibrary(search, filter, true)}>{libraryLoading ? "Carregando…" : "Carregar mais"}</button> : null}
      {mediaExercise ? <form className="training-media-form" onSubmit={(event) => void submitMedia(event)}><header><strong>Mídia: {mediaExercise.name}</strong><button type="button" onClick={() => setMediaExercise(null)}>Cancelar</button></header><p>MP4/H.264 curto com poster leve. GIF somente para exceções.</p><label><span>Formato</span><select name="mediaKind" defaultValue="video"><option value="video">Vídeo MP4</option><option value="gif">GIF (exceção)</option></select></label><label><span>Arquivo de demonstração</span><input name="media" type="file" required accept="video/mp4,image/gif" /></label><label><span>Poster estático</span><input name="poster" type="file" required accept="image/jpeg,image/png,image/webp" /></label><label><span>Duração do vídeo (seg.)</span><input name="durationSeconds" type="number" min="1" max="90" defaultValue="15" /></label><footer><button type="submit" disabled={mediaSaving}>{mediaSaving ? "Enviando…" : mediaExercise.media ? "Substituir mídia" : "Associar mídia"}</button>{mediaExercise.media ? <button type="button" disabled={mediaSaving} onClick={() => void removeMedia()}>Remover associação</button> : null}</footer></form> : null}
    </section></div> : null}
  </section>;
}
