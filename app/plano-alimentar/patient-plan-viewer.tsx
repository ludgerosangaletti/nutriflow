"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
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

function MealCard({ meal, optionIndex, swaps, onChangeOption, onOpenSwap, onUndoSwap }: {
  meal: PatientPortalMealV1;
  optionIndex: number;
  swaps: Record<string, SelectedSwap>;
  onChangeOption: (index: number) => void;
  onOpenSwap: (item: PatientPortalItemV1, groups: readonly PatientPortalSubstitutionV1[]) => void;
  onUndoSwap: (itemPublicId: string) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, width: 0, lock: null as "x" | "y" | null });
  const options = meal.options.length ? meal.options : [{ publicId: `${meal.publicId}_option_1`, label: "Opção 1", sortOrder: 0, items: meal.items, substitutions: meal.substitutions }];
  const multi = options.length > 1;

  const goTo = useCallback((target: number) => {
    const next = Math.max(0, Math.min(target, options.length - 1));
    onChangeOption(next);
  }, [onChangeOption, options.length]);

  function touchStart(x: number, y: number) {
    const rail = railRef.current;
    if (!rail || !multi) return;
    drag.current = { x, y, dx: 0, width: rail.offsetWidth, lock: null };
    rail.style.transition = "none";
  }
  function touchMove(x: number, y: number, event: TouchEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const state = drag.current;
    if (!rail || !state.width || !multi) return;
    const dx = x - state.x;
    const dy = y - state.y;
    if (!state.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
    }
    if (state.lock !== "x") return;
    if (event.cancelable) event.preventDefault();
    state.dx = dx;
    const min = -(options.length - 1) * state.width;
    let offset = -optionIndex * state.width + dx;
    if (offset > 0) offset *= .3;
    if (offset < min) offset = min + (offset - min) * .3;
    rail.style.transform = `translateX(${offset}px)`;
  }
  function touchEnd() {
    const rail = railRef.current;
    const state = drag.current;
    if (!rail) return;
    rail.style.transition = "";
    let target = optionIndex;
    if (state.lock === "x" && state.width) {
      if (state.dx < -state.width * .22) target = Math.min(optionIndex + 1, options.length - 1);
      else if (state.dx > state.width * .22) target = Math.max(optionIndex - 1, 0);
    }
    goTo(target);
    rail.style.transform = `translateX(-${target * 100}%)`;
  }

  return <article className="nf-meal-card-v4">
    <header><div><span>{meal.scheduledTime || "Horário flexível"}</span><h2>{meal.title}</h2></div></header>
    <div ref={railRef} className="nf-meal-options-rail" role="group" aria-label={`${meal.title}${multi ? `, ${options[optionIndex]?.label}` : ""}`} tabIndex={multi ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight") { goTo(optionIndex + 1); event.preventDefault(); } if (event.key === "ArrowLeft") { goTo(optionIndex - 1); event.preventDefault(); } }} onTouchStart={(event) => touchStart(event.touches[0].clientX, event.touches[0].clientY)} onTouchMove={(event) => touchMove(event.touches[0].clientX, event.touches[0].clientY, event)} onTouchEnd={touchEnd} style={{ transform: `translateX(-${optionIndex * 100}%)` }}>
      {options.map((option, currentIndex) => <section className="nf-meal-option-slide" key={option.publicId} aria-hidden={currentIndex !== optionIndex}>
        <div className="nf-food-list-v4">{option.items.map((item, itemIndex) => {
          const availableGroups = option.substitutions.filter((group) => group.options.length > 0);
          const linked = availableGroups.filter((group) => group.mealItemPublicId === item.publicId);
          const unlinked = availableGroups.filter((group) => !group.mealItemPublicId);
          const groups = linked.length ? linked : option.items.length === 1 ? unlinked : unlinked[itemIndex] ? [unlinked[itemIndex]] : [];
          const swap = swaps[item.publicId];
          return <div className="nf-food-row-v4" key={item.publicId}><div><strong>{swap?.displayName ?? item.displayName}</strong>{swap ? <small className="nf-swap-applied">Trocado · no lugar de {item.displayName}</small> : <small>{[item.preparation, item.notes].filter(Boolean).join(" · ") || "Conforme orientação do plano."}</small>}<div className="nf-food-actions-v4">{groups.length ? <button type="button" onClick={() => onOpenSwap(item, groups)}>{swap ? "Trocar novamente" : swapLabel(groups[0])}</button> : null}{swap ? <button type="button" onClick={() => onUndoSwap(item.publicId)}>Desfazer troca</button> : null}{item.recipe ? <details><summary>Modo de preparo</summary><p>{item.recipe.instructions || "Siga o preparo indicado pelo nutricionista."}</p></details> : null}</div></div><b>{swap ? quantity(swap.quantityMilli, swap.unit) : quantity(item.quantityMilli, item.unit)}</b></div>;
        })}</div>
      </section>)}
    </div>
    {multi ? <div className="nf-meal-option-switcher"><span>{options[optionIndex]?.label}</span><div role="tablist" aria-label={`Opções de ${meal.title}`}>{options.map((option, index) => <button key={option.publicId} type="button" role="tab" aria-selected={index === optionIndex} aria-label={option.label} onClick={() => goTo(index)}><i /></button>)}</div></div> : null}
    {meal.instructions ? <div className="nf-meal-guidance-v4"><span>Orientação desta refeição</span><p>{meal.instructions}</p></div> : null}
  </article>;
}

export default function PatientPlanViewer({ portal }: { portal: PatientPortalV1 }) {
  const [selectedStrategyId, setSelectedStrategyId] = useState(portal.plan?.days[0]?.publicId ?? null);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, SelectedSwap>>({});
  const [swapSheet, setSwapSheet] = useState<SwapSheetState | null>(null);
  const [selectedMealOptions, setSelectedMealOptions] = useState<Record<string, number>>({});
  const selectedStrategy = useMemo(() => portal.plan?.days.find((strategy) => strategy.publicId === selectedStrategyId) ?? portal.plan?.days[0] ?? null, [portal.plan, selectedStrategyId]);
  const activeStrategyItems = useMemo(() => selectedStrategy?.meals.flatMap((meal) => {
    const options = meal.options.length ? meal.options : [{ items: meal.items }];
    return options[Math.min(selectedMealOptions[meal.publicId] ?? 0, options.length - 1)]?.items ?? meal.items;
  }) ?? [], [selectedMealOptions, selectedStrategy]);
  const strategyMacros = useMemo(() => sumMacros(activeStrategyItems), [activeStrategyItems]);
  const strategyNutritionComplete = activeStrategyItems.length > 0 && activeStrategyItems.every((item) => item.macros?.energyKcal != null);

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
          {selectedStrategy.meals.map((meal) => <MealCard key={meal.publicId} meal={meal} optionIndex={selectedMealOptions[meal.publicId] ?? 0} swaps={selectedSwaps} onChangeOption={(index) => setSelectedMealOptions((current) => ({ ...current, [meal.publicId]: index }))} onOpenSwap={(item, groups) => setSwapSheet(Object.freeze({ item, groups }))} onUndoSwap={(itemPublicId) => setSelectedSwaps((current) => { const next = { ...current }; delete next[itemPublicId]; return next; })} />)}
        </div>

        <footer className="nf-plan-footer-v4"><div><span>Resumo da estratégia</span><strong>{strategyNutritionComplete ? (macroLabel(strategyMacros) || "Composição nutricional em atualização") : "Composição nutricional em atualização"}</strong></div><p>As opções e trocas exibidas foram cadastradas pelo seu nutricionista para esta estratégia.</p></footer>
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
