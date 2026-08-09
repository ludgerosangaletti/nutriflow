"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrainingEditorWorkspaceV1, TrainingExerciseLibraryItemV1, TrainingRoutineContentV1, TrainingWeekday } from "../../../../../modules/nutriflow/contracts/v1/training.ts";
import { addMuscleGroup, addTrainingExercise, emptyTrainingContent, groupsForDay, moveTrainingExercise, removeMuscleGroup, removeTrainingExercise, renameMuscleGroup, TRAINING_DAYS, updateTrainingExercise } from "./training-editor-state";

type Envelope<T> = { data?: T; errorCode?: string; message?: string };
const muscleGroups = ["peito", "costas", "ombros", "bÃ­ceps", "trÃ­ceps", "quadrÃ­ceps", "posterior de coxa", "glÃºteos", "panturrilhas", "core"];

function requestHeaders() { return { "content-type": "application/json", "x-correlation-id": `corr_${crypto.randomUUID()}` }; }
function numeric(value: string) { return value === "" ? null : Number(value); }

export default function TrainingEditor({ clientId, patientName }: Readonly<{ clientId: number; patientName: string }>) {
  const [workspace, setWorkspace] = useState<TrainingEditorWorkspaceV1 | null>(null);
  const [activeDay, setActiveDay] = useState<TrainingWeekday>("mon");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<TrainingRoutineContentV1>(emptyTrainingContent());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [library, setLibrary] = useState<readonly TrainingExerciseLibraryItemV1[]>([]);
  const [libraryGroupId, setLibraryGroupId] = useState<string | null>(null);
  const [mediaExercise, setMediaExercise] = useState<TrainingExerciseLibraryItemV1 | null>(null);
  const [mediaSaving, setMediaSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/nutriflow/training?clientId=${clientId}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
    if (!response.ok || !result.data) throw new Error(result.message || "NÃ£o foi possÃ­vel abrir o Treino.");
    setWorkspace(result.data);
    if (result.data.draft) { setTitle(result.data.draft.title); setContent(result.data.draft.content); }
  }, [clientId]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel abrir o Treino.")); }, [load]);

  async function action(action: "entitlement" | "create-draft" | "publish", command?: Record<string, unknown>) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/nutriflow/training", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ action, clientId, patientName, command }) });
      const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
      if (!response.ok || !result.data) throw new Error(result.message || "NÃ£o foi possÃ­vel concluir a aÃ§Ã£o.");
      setWorkspace(result.data);
      if (result.data.draft) { setTitle(result.data.draft.title); setContent(result.data.draft.content); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel concluir a aÃ§Ã£o."); }
    finally { setSaving(false); }
  }

  async function save() {
    if (!workspace?.draft) return;
    setSaving(true); setMessage("");
    try {
      const draft = workspace.draft;
      const response = await fetch("/api/admin/nutriflow/training", { method: "PATCH", headers: requestHeaders(), body: JSON.stringify({ clientId, command: { routinePublicId: draft.routinePublicId, routineVersionPublicId: draft.publicId, expectedRevision: draft.revision, title, content } }) });
      const result = await response.json().catch(() => ({})) as Envelope<TrainingEditorWorkspaceV1>;
      if (!response.ok || !result.data) throw new Error(result.message || "Revise os campos obrigatÃ³rios da prescriÃ§Ã£o.");
      setWorkspace(result.data); setContent(result.data.draft?.content ?? content); setMessage("Rascunho salvo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel salvar o rascunho."); }
    finally { setSaving(false); }
  }

  async function openLibrary(groupId: string) {
    setLibraryGroupId(groupId); setLibrary([]); setSearch(""); setFilter("");
    await searchLibrary("");
  }

  async function searchLibrary(query = search) {
    const parameters = new URLSearchParams({ clientId: String(clientId), query, limit: "20" });
    if (filter) parameters.set("muscleGroup", filter);
    const response = await fetch(`/api/admin/nutriflow/training/exercises?${parameters.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as Envelope<{ items: readonly TrainingExerciseLibraryItemV1[] }>;
    if (!response.ok || !result.data) { setMessage(result.message || "NÃ£o foi possÃ­vel consultar a biblioteca."); return; }
    setLibrary(result.data.items);
  }

  async function submitMedia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mediaExercise) return;
    setMediaSaving(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("clientId", String(clientId));
      const response = await fetch(`/api/admin/nutriflow/training/exercises/${encodeURIComponent(mediaExercise.publicId)}/media`, { method: "POST", headers: { "x-correlation-id": `corr_${crypto.randomUUID()}` }, body: form });
      const result = await response.json().catch(() => ({})) as Envelope<unknown>;
      if (!response.ok) throw new Error(result.message || "Não foi possível associar a mídia.");
      setMessage("Mídia associada. Exercícios publicados permanecem inalterados.");
      setMediaExercise(null); await searchLibrary();
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
      setMessage("Associação de mídia removida. Publicações anteriores foram preservadas.");
      setMediaExercise(null); await searchLibrary();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover a mídia."); }
    finally { setMediaSaving(false); }
  }

  if (!workspace) return <section className="training-editor training-loading"><p>Preparando o editor de treinoâ€¦</p>{message ? <p role="alert">{message}</p> : null}</section>;
  const groups = groupsForDay(content, activeDay);
  const activePublication = workspace.publication;

  return <section className="training-editor">
    <header className="training-editor-header">
      <div><p className="section-kicker">NutriFlow Training</p><h1>Treino de {patientName}</h1><p>{workspace.draft ? `Rascunho da versÃ£o ${workspace.draft.versionNumber}` : activePublication ? `VersÃ£o ${activePublication.versionNumber} publicada` : "Nenhuma rotina criada"}</p></div>
      <div className={`training-entitlement ${workspace.entitlement.active ? "is-active" : ""}`}><span>{workspace.entitlement.active ? "Training ativo" : "Training inativo"}</span><button type="button" disabled={saving} onClick={() => void action("entitlement", { active: !workspace.entitlement.active, reason: workspace.entitlement.active ? "Revogado pelo administrador" : "Ativado pelo administrador" })}>{workspace.entitlement.active ? "Revogar acesso" : "Ativar Training"}</button></div>
    </header>
    {message ? <p className="training-message" role="status">{message}</p> : null}
    {!workspace.entitlement.active ? <section className="training-empty"><h2>Training desativado</h2><p>Ative o acesso para montar a rotina. A revogaÃ§Ã£o preserva todas as versÃµes e publicaÃ§Ãµes existentes.</p></section> : null}
    {workspace.entitlement.active && !workspace.draft ? <section className="training-empty"><h2>{activePublication ? "Prepare a prÃ³xima versÃ£o" : "Comece a rotina semanal"}</h2><p>{activePublication ? "A versÃ£o publicada serÃ¡ usada como ponto de partida, sem alterar o que jÃ¡ foi entregue." : "Escolha um dia, adicione grupamentos e inclua os exercÃ­cios da biblioteca."}</p><button type="button" disabled={saving} onClick={() => void action("create-draft")}>{activePublication ? "Criar rascunho a partir da publicada" : "Criar rotina"}</button></section> : null}
    {workspace.draft ? <>
      <div className="training-status-bar"><span>Rascunho editÃ¡vel</span>{activePublication ? <small>Publicada agora: versÃ£o {activePublication.versionNumber}</small> : <small>Nenhuma versÃ£o publicada</small>}<button type="button" disabled={saving} onClick={() => void save()}>Salvar rascunho</button><button className="is-publish" type="button" disabled={saving || content.days.length === 0} onClick={() => { if (window.confirm("Publicar esta rotina? A versÃ£o publicada ficarÃ¡ imutÃ¡vel.")) void action("publish", { routinePublicId: workspace.draft!.routinePublicId, routineVersionPublicId: workspace.draft!.publicId, expectedRevision: workspace.draft!.revision }); }}>Publicar rotina</button></div>
      <label className="training-title"><span>TÃ­tulo da rotina</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Treino semanal" /></label>
      <nav className="training-days" aria-label="Dias da semana">{TRAINING_DAYS.map((day) => <button key={day.key} type="button" className={activeDay === day.key ? "is-active" : ""} onClick={() => setActiveDay(day.key)}><strong>{day.label}</strong><small>{groupsForDay(content, day.key).length ? `${groupsForDay(content, day.key).length} grup.` : "Descanso"}</small></button>)}</nav>
      <div className="training-day-panel"><header><div><p className="section-kicker">{TRAINING_DAYS.find((day) => day.key === activeDay)?.label}</p><h2>{groups.length ? "PrescriÃ§Ã£o do dia" : "Dia de descanso"}</h2></div><button type="button" onClick={() => setContent((current) => addMuscleGroup(current, activeDay))}>+ Adicionar grupamento</button></header>
      {!groups.length ? <p className="training-rest">Nenhum grupamento neste dia. O paciente o verÃ¡ como descanso.</p> : null}
      <div className="training-groups">{groups.map((group) => <article key={group.publicId} className="training-group"><header><input aria-label="Grupamento muscular" value={group.name} onChange={(event) => setContent((current) => renameMuscleGroup(current, activeDay, group.publicId, event.target.value))} list="training-muscle-groups" /><button type="button" className="is-remove" onClick={() => setContent((current) => removeMuscleGroup(current, activeDay, group.publicId))}>Remover</button></header>
        <div className="training-exercises">{group.exercises.map((exercise, index) => <article key={exercise.publicId} className="training-exercise"><header><div><strong>{exercise.exercise.name}</strong><small>{exercise.exercise.primaryMuscleGroup}</small></div><div className="training-order"><button type="button" disabled={index === 0} onClick={() => setContent((current) => moveTrainingExercise(current, activeDay, group.publicId, exercise.publicId, -1))}>â†‘</button><button type="button" disabled={index === group.exercises.length - 1} onClick={() => setContent((current) => moveTrainingExercise(current, activeDay, group.publicId, exercise.publicId, 1))}>â†“</button><button type="button" className="is-remove" onClick={() => setContent((current) => removeTrainingExercise(current, activeDay, group.publicId, exercise.publicId))}>Ã—</button></div></header><div className="training-prescription"><label><span>SÃ©ries</span><input inputMode="numeric" value={exercise.prescription.sets ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { sets: numeric(event.target.value) }))} /></label><label><span>Reps. min.</span><input inputMode="numeric" value={exercise.prescription.repetitions?.min ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { repetitions: { min: numeric(event.target.value) ?? 0, max: exercise.prescription.repetitions?.max ?? 0 }, durationSeconds: null }))} /></label><label><span>Reps. mÃ¡x.</span><input inputMode="numeric" value={exercise.prescription.repetitions?.max ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { repetitions: { min: exercise.prescription.repetitions?.min ?? 0, max: numeric(event.target.value) ?? 0 }, durationSeconds: null }))} /></label><label><span>Tempo (s)</span><input inputMode="numeric" value={exercise.prescription.durationSeconds ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { durationSeconds: numeric(event.target.value), repetitions: null }))} /></label><label><span>Descanso (s)</span><input inputMode="numeric" value={exercise.prescription.restSeconds ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { restSeconds: numeric(event.target.value) }))} /></label><label className="is-note"><span>ObservaÃ§Ã£o</span><input value={exercise.prescription.notes ?? ""} onChange={(event) => setContent((current) => updateTrainingExercise(current, activeDay, group.publicId, exercise.publicId, { notes: event.target.value || null }))} /></label></div></article>)}</div>
        <button type="button" className="training-add-exercise" onClick={() => void openLibrary(group.publicId)}>+ Adicionar exercÃ­cio</button>
        {libraryGroupId === group.publicId ? <section className="training-library">
          <header><strong>Biblioteca de exercícios</strong><button type="button" onClick={() => { setLibraryGroupId(null); setMediaExercise(null); }}>Fechar</button></header>
          <div><input placeholder="Pesquisar exercício" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos os grupamentos</option>{muscleGroups.map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="button" onClick={() => void searchLibrary()}>Buscar</button></div>
          <ul>{library.map((item) => <li key={item.publicId}><div><strong>{item.name}</strong><small>{item.primaryMuscleGroup} · {item.scope === "global" ? "Biblioteca global" : "Da organização"} · {item.media ? "Mídia associada" : "Sem mídia"}</small></div><span><button type="button" onClick={() => setMediaExercise(item)}>Mídia</button><button type="button" onClick={() => { setContent((current) => addTrainingExercise(current, activeDay, group.publicId, item)); setLibraryGroupId(null); setMediaExercise(null); }}>Adicionar</button></span></li>)}</ul>
          {mediaExercise ? <form className="training-media-form" onSubmit={(event) => void submitMedia(event)}>
            <header><strong>Mídia: {mediaExercise.name}</strong><button type="button" onClick={() => setMediaExercise(null)}>Cancelar</button></header>
            <p>MP4/H.264 curto com poster leve. GIF somente para exceções.</p>
            <label><span>Formato</span><select name="mediaKind" defaultValue="video"><option value="video">Vídeo MP4</option><option value="gif">GIF (exceção)</option></select></label>
            <label><span>Arquivo de demonstração</span><input name="media" type="file" required accept="video/mp4,image/gif" /></label>
            <label><span>Poster estático</span><input name="poster" type="file" required accept="image/jpeg,image/png,image/webp" /></label>
            <label><span>Duração do vídeo (seg.)</span><input name="durationSeconds" type="number" min="1" max="90" defaultValue="15" /></label>
            <footer><button type="submit" disabled={mediaSaving}>{mediaSaving ? "Enviando…" : mediaExercise.media ? "Substituir mídia" : "Associar mídia"}</button>{mediaExercise.media ? <button type="button" disabled={mediaSaving} onClick={() => void removeMedia()}>Remover associação</button> : null}</footer>
          </form> : null}
        </section> : null}
      </article>)}</div></div>
      <datalist id="training-muscle-groups">{muscleGroups.map((name) => <option key={name} value={name} />)}</datalist>
    </> : null}
  </section>;
}
