"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  PatientPortalItemV1,
  PatientPortalMealV1,
  PatientPortalSubstitutionV1,
  PatientPortalUnitV1,
  PatientPortalV1,
} from "../../modules/nutriflow/contracts/v1/patient-portal.ts";

type MacroSnapshot = Readonly<{
  energyKcal?: number | null;
  protein?: number | null;
  carbohydrate?: number | null;
  fat?: number | null;
  fiber?: number | null;
}>;

type SelectedSwap = Readonly<{
  groupPublicId: string;
  optionPublicId: string;
  displayName: string;
  quantityMilli: number;
  unit: PatientPortalUnitV1;
}>;

type SwapSheetState = Readonly<{
  item: PatientPortalItemV1;
  groups: readonly PatientPortalSubstitutionV1[];
}>;

const UNIT_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
  g: "g",
  gram: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  unit: "unidade",
  unidade: "unidade",
  portion: "porção",
  slice: "fatia",
  colher_sopa: "colher de sopa",
  colher_cha: "colher de chá",
  cup: "xícara",
});

function unitLabel(unit: PatientPortalUnitV1 | null | undefined) {
  const label = unit?.label?.trim();
  if (label && label.toLowerCase() !== "undefined" && label.toLowerCase() !== "null") return label;
  const code = unit?.code?.trim().toLowerCase();
  return (code && UNIT_FALLBACKS[code]) || "unidade";
}

function quantity(quantityMilli: number, unit: PatientPortalUnitV1 | null | undefined) {
  const code = unit?.code?.trim().toLowerCase();
  const label = unitLabel(unit);
  if (["as_desired", "a_vontade", "free", "livre"].includes(code ?? "") || /à vontade|a vontade/i.test(label)) return "À vontade";
  const value = Number(quantityMilli) / 1000;
  const safeValue = Number.isFinite(value) ? value : 1;
  return `${safeValue.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${label}`;
}

function macroLabel(macros?: MacroSnapshot | null) {
  if (!macros) return null;
  const parts = [
    macros.energyKcal != null ? `${Math.round(macros.energyKcal)} kcal` : null,
    macros.protein != null ? `${Number(macros.protein).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g proteínas` : null,
    macros.carbohydrate != null ? `${Number(macros.carbohydrate).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g carboidratos` : null,
    macros.fat != null ? `${Number(macros.fat).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g gorduras` : null,
    macros.fiber != null ? `${Number(macros.fiber).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g fibras` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function sumMacros(entries: readonly { macros?: MacroSnapshot | null }[]) {
  const keys = ["energyKcal", "protein", "carbohydrate", "fat", "fiber"] as const;
  return Object.freeze(Object.fromEntries(keys.map((key) => [
    key,
    entries.some((entry) => entry.macros?.[key] != null)
      ? entries.reduce((total, entry) => total + Number(entry.macros?.[key] ?? 0), 0)
      : null,
  ]))) as MacroSnapshot;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function swapLabel(group: PatientPortalSubstitutionV1) {
  const title = group.title.trim();
  if (/prote[ií]na/i.test(title)) return "Trocar a proteína";
  if (/fruta/i.test(title)) return "Trocar a fruta";
  if (/carbo|acompanhamento/i.test(title)) return "Trocar o acompanhamento";
  return title && !/^troca|^substitui/i.test(title) ? title : "Trocar este alimento";
}

function groupsForItem(meal: PatientPortalMealV1, item: PatientPortalItemV1, itemIndex: number) {
  const linked = meal.substitutions.filter((group) => group.mealItemPublicId === item.publicId);
  if (linked.length) return linked;
  const unlinked = meal.substitutions.filter((group) => !group.mealItemPublicId);
  if (meal.items.length === 1) return unlinked;
  return unlinked[itemIndex] ? [unlinked[itemIndex]] : [];
}

function WeightTrend({ values }: { values: PatientPortalV1["weightEvolution"] }) {
  if (!values.length) return <p className="nf-patient-empty-copy">Seus registros de peso aparecerão aqui após os check-ins.</p>;
  const weights = values.map((entry) => entry.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(1, max - min);
  const points = weights.map((weight, index) => {
    const x = weights.length === 1 ? 50 : (index / (weights.length - 1)) * 100;
    const y = 88 - ((weight - min) / range) * 68;
    return `${x},${y}`;
  }).join(" ");
  const latest = values.at(-1)!;
  return <div className="nf-weight-trend">
    <div><span>Peso mais recente</span><strong>{latest.weightKg.toLocaleString("pt-BR")} kg</strong><small>{shortDate(latest.recordedAt)}</small></div>
    <svg role="img" aria-label="Evolução do peso nos check-ins" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg>
  </div>;
}

function SwapSheet({ state, selected, onSelect, onClose }: {
  state: SwapSheetState;
  selected: SelectedSwap | null;
  onSelect: (group: PatientPortalSubstitutionV1, option: PatientPortalSubstitutionV1["options"][number] | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", close);
    document.body.classList.add("nf-sheet-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("nf-sheet-open"); };
  }, [onClose]);

  return <div className="nf-swap-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nf-swap-sheet" role="dialog" aria-modal="true" aria-labelledby="nf-swap-title">
      <header><div><span>Substituições orientadas</span><h3 id="nf-swap-title">Trocar {state.item.displayName}</h3></div><button type="button" onClick={onClose} aria-label="Fechar opções">×</button></header>
      <p>Escolha uma alternativa prescrita pelo seu nutricionista.</p>
      {state.groups.map((group) => <div className="nf-swap-group" key={group.publicId}>
        <h4>{group.title}</h4>
        {group.notes ? <small>{group.notes}</small> : null}
        <button className={!selected ? "is-selected" : ""} type="button" onClick={() => onSelect(group, null)}><span><strong>{state.item.displayName}</strong><small>Opção original</small></span><b>{quantity(state.item.quantityMilli, state.item.unit)}</b></button>
        {group.options.map((option) => <button className={selected?.optionPublicId === option.publicId ? "is-selected" : ""} type="button" key={option.publicId} onClick={() => onSelect(group, option)}><span><strong>{option.displayName}</strong>{option.notes ? <small>{option.notes}</small> : null}</span><b>{quantity(option.quantityMilli, option.unit)}</b></button>)}
      </div>)}
      <button className="nf-swap-cancel" type="button" onClick={onClose}>Continuar sem alterar</button>
    </section>
  </div>;
}

export default function PatientPlanViewer({ portal }: { portal: PatientPortalV1 }) {
  const [selectedStrategyId, setSelectedStrategyId] = useState(portal.plan?.days[0]?.publicId ?? null);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, SelectedSwap>>({});
  const [swapSheet, setSwapSheet] = useState<SwapSheetState | null>(null);
  const [doneMeals, setDoneMeals] = useState<Record<string, boolean>>({});
  const selectedStrategy = useMemo(() => portal.plan?.days.find((strategy) => strategy.publicId === selectedStrategyId) ?? portal.plan?.days[0] ?? null, [portal.plan, selectedStrategyId]);
  const strategyMacros = useMemo(() => selectedStrategy ? sumMacros(selectedStrategy.meals) : null, [selectedStrategy]);
  const strategyNutritionComplete = selectedStrategy?.meals.length ? selectedStrategy.meals.every((meal) => meal.nutritionComplete) : false;

  useEffect(() => {
    if (!portal.plan?.publicationPublicId) return;
    const controller = new AbortController();
    void fetch("/api/nutriflow/v1/portal", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiVersion: "v1", publicationPublicId: portal.plan.publicationPublicId }),
      cache: "no-store", credentials: "same-origin", signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [portal.plan?.publicationPublicId]);

  useEffect(() => {
    if (!portal.plan?.publicationPublicId) return;
    try {
      const stored = window.localStorage.getItem(`nutriflow:meals:${portal.plan.publicationPublicId}`);
      if (stored) setDoneMeals(JSON.parse(stored) as Record<string, boolean>);
    } catch { /* O registro local é opcional e não representa adesão clínica. */ }
  }, [portal.plan?.publicationPublicId]);

  function toggleDone(mealId: string) {
    setDoneMeals((current) => {
      const next = { ...current, [mealId]: !current[mealId] };
      if (portal.plan?.publicationPublicId) {
        try { window.localStorage.setItem(`nutriflow:meals:${portal.plan.publicationPublicId}`, JSON.stringify(next)); } catch { /* opcional */ }
      }
      return next;
    });
  }

  function chooseSwap(group: PatientPortalSubstitutionV1, option: PatientPortalSubstitutionV1["options"][number] | null) {
    if (!swapSheet) return;
    setSelectedSwaps((current) => {
      const next = { ...current };
      if (!option) delete next[swapSheet.item.publicId];
      else next[swapSheet.item.publicId] = Object.freeze({ groupPublicId: group.publicId, optionPublicId: option.publicId, displayName: option.displayName, quantityMilli: option.quantityMilli, unit: option.unit });
      return next;
    });
    setSwapSheet(null);
  }

  const completedInStrategy = selectedStrategy?.meals.filter((meal) => doneMeals[meal.publicId]).length ?? 0;
  const nextMealId = selectedStrategy?.meals.find((meal) => !doneMeals[meal.publicId])?.publicId;

  return <div className="nf-patient-dashboard nf-plan-v4">
    {portal.plan ? <>
      {portal.plan.days.length > 1 ? <section className="nf-strategy-picker nf-strategy-picker-compact">
        <div><span>Estratégias disponíveis</span><small>{portal.plan.days.length} estratégias</small></div>
        <nav aria-label="Estratégias do plano alimentar">{portal.plan.days.map((strategy, index) => <button className={strategy.publicId === selectedStrategy?.publicId ? "is-active" : ""} key={strategy.publicId} type="button" aria-pressed={strategy.publicId === selectedStrategy?.publicId} onClick={() => setSelectedStrategyId(strategy.publicId)}><small>{String(index + 1).padStart(2, "0")}</small><strong>{strategy.label}</strong><span>{strategy.meals.length} {strategy.meals.length === 1 ? "refeição" : "refeições"}</span></button>)}</nav>
      </section> : null}

      {selectedStrategy ? <section className="nf-plan-content-v4">
        <header className="nf-plan-header-v4">
          <div><p className="section-kicker">Seu plano alimentar</p><h1>{selectedStrategy.label || portal.plan.title}</h1><p>{portal.plan.days.length > 1 ? portal.plan.title : `${selectedStrategy.meals.length} refeições organizadas para esta estratégia.`}</p></div>
          <aside><span>Atualizado em {shortDate(portal.plan.publishedAt)}</span><a href="/api/nutriflow/v1/plan-pdf" target="_blank" rel="noreferrer">Imprimir / PDF ↗</a></aside>
        </header>

        <div className="nf-patient-meals-v4">
          {selectedStrategy.meals.map((meal) => <article className={`nf-meal-card-v4 ${doneMeals[meal.publicId] ? "is-done" : ""} ${meal.publicId === nextMealId ? "is-next" : ""}`} key={meal.publicId}>
            <header><div><span>{meal.publicId === nextMealId ? "Agora · " : ""}{meal.scheduledTime || "Horário flexível"}</span><h2>{meal.title}</h2></div><button type="button" className="nf-meal-mark-v4" aria-pressed={Boolean(doneMeals[meal.publicId])} aria-label={`${doneMeals[meal.publicId] ? "Desmarcar" : "Marcar"} ${meal.title} como realizada`} onClick={() => toggleDone(meal.publicId)}>{doneMeals[meal.publicId] ? "✓" : ""}</button></header>
            <div className="nf-food-list-v4">{meal.items.map((item, itemIndex) => {
              const groups = groupsForItem(meal, item, itemIndex);
              const swap = selectedSwaps[item.publicId];
              return <div className="nf-food-row-v4" key={item.publicId}>
                <div><strong>{swap?.displayName ?? item.displayName}</strong>{swap ? <small className="nf-swap-applied">Trocado · no lugar de {item.displayName}</small> : <small>{[item.preparation, item.notes].filter(Boolean).join(" · ") || "Conforme orientação do plano."}</small>}
                  <div className="nf-food-actions-v4">{groups.length ? <button type="button" onClick={() => setSwapSheet(Object.freeze({ item, groups }))}>{swap ? "Trocar novamente" : swapLabel(groups[0])}</button> : null}{swap ? <button type="button" onClick={() => setSelectedSwaps((current) => { const next = { ...current }; delete next[item.publicId]; return next; })}>Desfazer troca</button> : null}{item.recipe ? <details><summary>Modo de preparo</summary><p>{item.recipe.instructions || "Siga o preparo indicado pelo nutricionista."}</p></details> : null}</div>
                </div><b>{swap ? quantity(swap.quantityMilli, swap.unit) : quantity(item.quantityMilli, item.unit)}</b>
              </div>;
            })}</div>
            {meal.instructions ? <div className="nf-meal-guidance-v4"><span>Orientação desta refeição</span><p>{meal.instructions}</p></div> : null}
          </article>)}
        </div>

        <footer className="nf-plan-footer-v4"><div><span>Resumo da estratégia</span><strong>{strategyNutritionComplete ? (macroLabel(strategyMacros) || "Composição nutricional em atualização") : "Composição nutricional em atualização"}</strong></div><p>{completedInStrategy ? `${completedInStrategy} de ${selectedStrategy.meals.length} refeições marcadas neste aparelho.` : "Use as marcações apenas para organizar sua rotina. Elas não são usadas como cobrança."}</p></footer>
      </section> : null}

      {portal.plan.patientNotes.length ? <section className="nf-patient-notes"><span>Orientações importantes</span>{portal.plan.patientNotes.map((note, index) => <p key={`${index}-${note.slice(0, 16)}`}>{note}</p>)}</section> : null}
    </> : <section className="nf-patient-plan-empty"><span aria-hidden="true">◌</span><div><p className="section-kicker">Em preparação</p><h2>Seu plano estruturado aparecerá aqui.</h2><p>Assim que seu nutricionista publicar a estratégia, ela ficará disponível neste espaço.</p><Link className="button button-dark" href="/documentos">Ver documentos atuais</Link></div></section>}

    <details className="nf-plan-more"><summary><span>Mais do seu acompanhamento</span><small>Avaliação, evolução e check-in</small></summary><section className="nf-patient-support-grid">
      <article><span>Avaliação física</span><strong>{portal.physicalAssessment.available ? portal.physicalAssessment.title : "Aguardando registro"}</strong><p>{portal.physicalAssessment.available && portal.physicalAssessment.publishedAt ? `Publicada em ${shortDate(portal.physicalAssessment.publishedAt)}.` : "Quando disponibilizada, a avaliação ficará vinculada ao seu acompanhamento."}</p>{portal.physicalAssessment.href ? <Link href={portal.physicalAssessment.href}>Abrir avaliação →</Link> : null}</article>
      <article><span>Evolução de peso</span><WeightTrend values={portal.weightEvolution} /></article>
      <article><span>Check-in periódico</span><strong>{portal.checkIn.status === "completed-this-week" ? "Concluído nesta semana" : "Disponível para preencher"}</strong><p>Seus próximos registros alimentarão a evolução e ajudarão nos ajustes do plano.</p><Link href={portal.checkIn.href}>{portal.checkIn.status === "completed-this-week" ? "Ver histórico" : "Responder check-in"} →</Link></article>
    </section></details>

    {swapSheet ? <SwapSheet state={swapSheet} selected={selectedSwaps[swapSheet.item.publicId] ?? null} onSelect={chooseSwap} onClose={() => setSwapSheet(null)} /> : null}
  </div>;
}
