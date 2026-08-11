import {
  TRAINING_ANAMNESIS_ACTIVITIES, TRAINING_ANAMNESIS_CURRENT_ROUTINE, TRAINING_ANAMNESIS_DURATIONS,
  TRAINING_ANAMNESIS_EQUIPMENT, TRAINING_ANAMNESIS_EXPERIENCE, TRAINING_ANAMNESIS_LOCATIONS,
  TRAINING_ANAMNESIS_OBJECTIVES, TRAINING_ANAMNESIS_PRIORITIES, type TrainingAnamnesisV1,
} from "../../../../../modules/nutriflow/contracts/v1/training-anamnesis.ts";

function label(options: readonly (readonly [string, string])[], value: string | null) {
  return options.find(([key]) => key === value)?.[1] ?? value ?? "Não informado";
}

function list(options: readonly (readonly [string, string])[], values: readonly string[], other: string | null) {
  return values.map((value) => value === "other" && other ? other : label(options, value)).join(" · ") || "Não informado";
}

const dayLabels = { mon: "SEG", tue: "TER", wed: "QUA", thu: "QUI", fri: "SEX", sat: "SÁB", sun: "DOM" } as const;

export default function TrainingAnamnesisSummary({ anamnesis }: Readonly<{ anamnesis: TrainingAnamnesisV1 | null }>) {
  if (!anamnesis) return <section className="training-anamnesis-admin is-pending"><div><p className="section-kicker">Anamnese de treino</p><strong>Pendente</strong><span>O paciente ainda não concluiu as informações iniciais.</span></div></section>;
  const a = anamnesis.answers;
  const warnings = [a.pain ? a.painDetails : null, a.injuryHistory ? a.injuryHistoryDetails : null, a.professionalRestrictions ? a.professionalRestrictionsDetails : null, a.healthCondition ? a.healthConditionDetails : null].filter(Boolean);
  const activity = a.otherActivity === "none" ? "Não pratica" : `${a.otherActivityDetails || label(TRAINING_ANAMNESIS_ACTIVITIES, a.otherActivity)}${a.otherActivityFrequency ? ` · ${a.otherActivityFrequency}x/sem` : ""}`;
  return <details className="training-anamnesis-admin">
    <summary><div><p className="section-kicker">Resumo da anamnese</p><strong>{a.objective === "other" ? a.objectiveOther : label(TRAINING_ANAMNESIS_OBJECTIVES, a.objective)}</strong><span>{a.trainingDaysPerWeek}x/sem · {label(TRAINING_ANAMNESIS_DURATIONS, a.sessionDuration)}</span></div><small>Atualizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(anamnesis.submittedAt ?? anamnesis.updatedAt ?? Date.now()))}</small><i aria-hidden="true">⌄</i></summary>
    <div className="training-anamnesis-admin-grid">
      <article><span>Objetivo</span><strong>{a.objective === "other" ? a.objectiveOther : label(TRAINING_ANAMNESIS_OBJECTIVES, a.objective)}</strong></article>
      <article><span>Experiência</span><strong>{label(TRAINING_ANAMNESIS_EXPERIENCE, a.experience)}</strong><small>{label(TRAINING_ANAMNESIS_CURRENT_ROUTINE, a.currentRoutine)}</small></article>
      <article><span>Disponibilidade</span><strong>{a.trainingDaysPerWeek}x/sem · {a.availableDays.map((day) => dayLabels[day]).join(" · ")}</strong><small>{label(TRAINING_ANAMNESIS_DURATIONS, a.sessionDuration)}</small></article>
      <article><span>Prioridades</span><strong>{list(TRAINING_ANAMNESIS_PRIORITIES, a.priorities, a.priorityOther)}</strong></article>
      <article><span>Estrutura</span><strong>{a.trainingLocation === "other" ? a.trainingLocationOther : label(TRAINING_ANAMNESIS_LOCATIONS, a.trainingLocation)}</strong>{a.equipment.length ? <small>{list(TRAINING_ANAMNESIS_EQUIPMENT, a.equipment, a.equipmentOther)}</small> : null}</article>
      <article><span>Outras atividades</span><strong>{activity}</strong></article>
      <article><span>Preferências</span><strong>Gosta: {a.likedExercises || "Não informado"}</strong><small>Evitar: {a.dislikedExercises || "Não informado"}</small></article>
      <article className={warnings.length ? "is-attention" : ""}><span>{warnings.length ? "⚠ Pontos de atenção" : "Pontos de atenção"}</span><strong>{warnings.length ? warnings.join(" · ") : "Nenhum ponto relatado"}</strong></article>
    </div>
    <details className="training-anamnesis-full"><summary>Consultar anamnese completa</summary><div>
      <article><span>Segurança na execução</span><p>{a.unsafeExercises ? a.unsafeExercisesDetails : "Não relatou exercícios inseguros."}</p></article>
      <article><span>Dor ou desconforto</span><p>{a.pain ? a.painDetails : "Não relatado."}</p></article>
      <article><span>Lesões, cirurgias ou limitações</span><p>{a.injuryHistory ? a.injuryHistoryDetails : "Não relatado."}</p></article>
      <article><span>Orientações profissionais</span><p>{a.professionalRestrictions ? a.professionalRestrictionsDetails : "Não relatado."}</p></article>
      <article><span>Condições de saúde</span><p>{a.healthCondition ? a.healthConditionDetails : "Não relatado."}</p></article>
      <article><span>Observações finais</span><p>{a.additionalNotes || "Nenhuma observação adicional."}</p></article>
    </div></details>
  </details>;
}
