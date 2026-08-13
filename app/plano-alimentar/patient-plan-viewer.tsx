"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import type { PatientPortalItemV1, PatientPortalMealV1, PatientPortalSubstitutionV1, PatientPortalUnitV1, PatientPortalV1 } from "../../modules/nutriflow/contracts/v1/patient-portal.ts";
import type { ReportRecipeSnapshot } from "../../modules/nutriflow/reports/professional-pdf.ts";

type SelectedSwap = Readonly<{ groupPublicId: string; optionPublicId: string; displayName: string; quantityMilli: number; unit: PatientPortalUnitV1 }>;
type SwapSheetState = Readonly<{ item: PatientPortalItemV1; groups: readonly PatientPortalSubstitutionV1[] }>;
type DisplayUnit = Readonly<{ label?: string; code?: string }>;
type RecipeContent = Readonly<{ name: string; instructions: string | null; ingredients: readonly Readonly<{ displayName: string; quantityMilli: number; unit: DisplayUnit; preparation: string | null }>[] }>;

const UNIT_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({ g: "g", gram: "g", kg: "kg", ml: "ml", l: "L", unit: "unidade", unidade: "unidade", portion: "porção", slice: "fatia", colher_sopa: "colher de sopa", colher_cha: "colher de chá", cup: "xícara" });

function unitLabel(unit: DisplayUnit | null | undefined) {
  const label = unit?.label?.trim();
  if (label && !["undefined", "null"].includes(label.toLowerCase())) return label;
  return (unit?.code && UNIT_FALLBACKS[unit.code.trim().toLowerCase()]) || "unidade";
}

function quantity(quantityMilli: number, unit: DisplayUnit | null | undefined) {
  const code = unit?.code?.trim().toLowerCase();
  const label = unitLabel(unit);
  if (["as_desired", "a_vontade", "free", "livre"].includes(code ?? "") || /à vontade|a vontade/i.test(label)) return "À vontade";
  const amount = Number(quantityMilli) / 1000;
  return `${(Number.isFinite(amount) ? amount : 1).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${label}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function optionsFor(meal: PatientPortalMealV1) {
  return meal.options.length ? meal.options : [Object.freeze({ publicId: `${meal.publicId}_option_1`, label: "Opção 1", sortOrder: 0, items: meal.items, substitutions: meal.substitutions })];
}

function groupsFor(item: PatientPortalItemV1, option: ReturnType<typeof optionsFor>[number], itemIndex: number) {
  const available = option.substitutions.filter((group) => group.options.length > 0);
  const linked = available.filter((group) => group.mealItemPublicId === item.publicId);
  if (linked.length) return linked;
  const unlinked = available.filter((group) => !group.mealItemPublicId);
  return option.items.length === 1 ? unlinked : unlinked[itemIndex] ? [unlinked[itemIndex]] : [];
}

function recipeKey(item: PatientPortalItemV1) { return item.recipe ? `${item.recipe.publicId}@${item.recipe.versionNumber}` : null; }

function recipeFor(item: PatientPortalItemV1, recipes: Readonly<Record<string, ReportRecipeSnapshot>>) {
  if (!item.recipe) return null;
  const saved = recipes[recipeKey(item)!];
  if (saved) return saved as RecipeContent;
  return Object.freeze({ name: item.displayName, instructions: item.recipe.instructions, ingredients: Object.freeze([]) }) as RecipeContent;
}

function currentMealId(meals: readonly PatientPortalMealV1[]) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduled = meals.map((meal) => {
    const match = meal.scheduledTime?.match(/^(\d{1,2}):(\d{2})/);
    return { id: meal.publicId, minutes: match ? Number(match[1]) * 60 + Number(match[2]) : null };
  }).filter((meal): meal is { id: string; minutes: number } => meal.minutes != null);
  return scheduled.filter((meal) => meal.minutes <= nowMinutes).at(-1)?.id ?? scheduled[0]?.id ?? null;
}

function nutritionFor(meals: readonly PatientPortalMealV1[], optionIndexes: Readonly<Record<string, number>>) {
  const items = meals.flatMap((meal) => {
    const options = optionsFor(meal);
    return options[Math.min(optionIndexes[meal.publicId] ?? 0, options.length - 1)]?.items ?? [];
  });
  const complete = items.length > 0 && items.every((item) => item.macros?.energyKcal != null && item.macros?.protein != null && item.macros?.carbohydrate != null && item.macros?.fat != null);
  if (!complete) return Object.freeze({ complete: false, energyKcal: null, protein: null, carbohydrate: null, fat: null });
  return Object.freeze({ complete: true, energyKcal: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.energyKcal), 0)), protein: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.protein), 0)), carbohydrate: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.carbohydrate), 0)), fat: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.fat), 0)) });
}

function WeightTrend({ values }: { values: PatientPortalV1["weightEvolution"] }) {
  if (!values.length) return <p className="nf-patient-empty-copy">Seus registros de peso aparecerão aqui após os check-ins.</p>;
  const weights = values.map((entry) => entry.weightKg);
  const minimum = Math.min(...weights);
  const range = Math.max(1, Math.max(...weights) - minimum);
  const points = weights.map((weight, index) => `${weights.length === 1 ? 50 : index / (weights.length - 1) * 100},${88 - (weight - minimum) / range * 68}`).join(" ");
  const latest = values.at(-1)!;
  return <div className="nf-weight-trend"><div><span>Peso mais recente</span><strong>{latest.weightKg.toLocaleString("pt-BR")} kg</strong><small>{shortDate(latest.recordedAt)}</small></div><svg role="img" aria-label="Evolução do peso nos check-ins" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg></div>;
}

function RecipeScreen({ recipe, onClose }: { recipe: RecipeContent; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    document.body.classList.add("nf-plan-overlay-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("nf-plan-overlay-open"); };
  }, [onClose]);
  return <section className="nf-recipe-screen" role="dialog" aria-modal="true" aria-label={`Receita: ${recipe.name}`}>
    <button className="nf-plan-back" type="button" onClick={onClose}>← Voltar ao plano</button>
    <p className="section-kicker">Receita</p><h2>{recipe.name}</h2>
    {recipe.ingredients.length ? <><h3>Ingredientes</h3><ul>{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.displayName}-${index}`}>{ingredient.displayName} - {quantity(ingredient.quantityMilli, ingredient.unit)}{ingredient.preparation ? ` (${ingredient.preparation})` : ""}</li>)}</ul></> : null}
    {recipe.instructions ? <><h3>Modo de preparo</h3><p className="nf-recipe-instructions">{recipe.instructions}</p></> : <p className="nf-recipe-instructions">Siga o preparo indicado pelo seu nutricionista.</p>}
    <button className="nf-plan-close-recipe" type="button" onClick={onClose}>Voltar ao plano</button>
  </section>;
}

function SwapSheet({ state, selected, onSelect, onClose }: { state: SwapSheetState; selected: SelectedSwap | null; onSelect: (group: PatientPortalSubstitutionV1, option: PatientPortalSubstitutionV1["options"][number] | null) => void; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    document.body.classList.add("nf-plan-overlay-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("nf-plan-overlay-open"); };
  }, [onClose]);
  return <div className="nf-swap-backdrop nf-plan-swap-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nf-swap-sheet nf-plan-swap-sheet" role="dialog" aria-modal="true" aria-labelledby="nf-plan-swap-title">
      <header><div><span>Substituições orientadas</span><h3 id="nf-plan-swap-title">Trocar {state.item.displayName}</h3></div><button type="button" onClick={onClose} aria-label="Fechar substituições">×</button></header>
      <p>Equivalências prescritas para esta refeição. A opção original permanece disponível.</p>
      {state.groups.map((group) => <section className="nf-plan-swap-group" key={group.publicId}><h4>{group.title}</h4>{group.notes ? <small>{group.notes}</small> : null}<button className={!selected ? "is-selected" : ""} type="button" onClick={() => onSelect(group, null)}><span><strong>{state.item.displayName}</strong><small>Opção original</small></span><b>{quantity(state.item.quantityMilli, state.item.unit)}</b></button>{group.options.map((option) => <button className={selected?.optionPublicId === option.publicId ? "is-selected" : ""} type="button" key={option.publicId} onClick={() => onSelect(group, option)}><span><strong>{option.displayName}</strong>{option.notes ? <small>{option.notes}</small> : null}</span><b>{quantity(option.quantityMilli, option.unit)}</b></button>)}</section>)}
      <button className="nf-swap-cancel" type="button" onClick={onClose}>Continuar sem alterar</button>
    </section>
  </div>;
}

function MealCard({ meal, optionIndex, current, swaps, recipes, onChangeOption, onOpenSwap, onUndoSwap, onOpenRecipe }: { meal: PatientPortalMealV1; optionIndex: number; current: boolean; swaps: Readonly<Record<string, SelectedSwap>>; recipes: Readonly<Record<string, ReportRecipeSnapshot>>; onChangeOption: (index: number) => void; onOpenSwap: (item: PatientPortalItemV1, groups: readonly PatientPortalSubstitutionV1[]) => void; onUndoSwap: (itemPublicId: string) => void; onOpenRecipe: (recipe: RecipeContent) => void }) {
  const options = optionsFor(meal);
  const multi = options.length > 1;
  const railRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, width: 0, lock: null as "x" | "y" | null });
  const goTo = useCallback((target: number) => onChangeOption(Math.max(0, Math.min(target, options.length - 1))), [onChangeOption, options.length]);
  function touchStart(x: number, y: number) { const rail = railRef.current; if (!rail || !multi) return; drag.current = { x, y, dx: 0, width: rail.offsetWidth, lock: null }; rail.style.transition = "none"; }
  function touchMove(x: number, y: number, event: TouchEvent<HTMLDivElement>) { const rail = railRef.current; const state = drag.current; if (!rail || !state.width || !multi) return; const dx = x - state.x; const dy = y - state.y; if (!state.lock) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; state.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y"; } if (state.lock !== "x") return; if (event.cancelable) event.preventDefault(); state.dx = dx; const minimum = -(options.length - 1) * state.width; let offset = -optionIndex * state.width + dx; if (offset > 0) offset *= .3; if (offset < minimum) offset = minimum + (offset - minimum) * .3; rail.style.transform = `translateX(${offset}px)`; }
  function touchEnd() { const rail = railRef.current; const state = drag.current; if (!rail) return; rail.style.transition = ""; let target = optionIndex; if (state.lock === "x" && state.width) { if (state.dx < -state.width * .22) target += 1; else if (state.dx > state.width * .22) target -= 1; } goTo(target); }
  return <article className={`nf-meal-card-v5${current ? " is-current" : ""}`}>
    <header><div><span>{current ? "Agora · " : ""}{meal.scheduledTime || "Horário flexível"}</span><h2>{meal.title}</h2></div></header>
    {multi ? <p className="nf-plan-swipe-note">Escolha <strong>uma</strong> das opções - elas se equivalem. Deslize para trocar.</p> : null}
    <div className="nf-plan-option-viewport-v5"><div ref={railRef} className="nf-plan-option-rail-v5" role="group" aria-label={`${meal.title}${multi ? `, ${options[optionIndex]?.label}` : ""}`} tabIndex={multi ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight") { goTo(optionIndex + 1); event.preventDefault(); } if (event.key === "ArrowLeft") { goTo(optionIndex - 1); event.preventDefault(); } }} onTouchStart={(event) => touchStart(event.touches[0].clientX, event.touches[0].clientY)} onTouchMove={(event) => touchMove(event.touches[0].clientX, event.touches[0].clientY, event)} onTouchEnd={touchEnd} style={{ transform: `translateX(-${optionIndex * 100}%)` }}>
      {options.map((option, optionPosition) => <section className="nf-plan-option-slide-v5" key={option.publicId} aria-hidden={optionPosition !== optionIndex}>{option.items.map((item, index) => {
        const groups = groupsFor(item, option, index); const swap = swaps[item.publicId]; const detail = swap ? `No lugar de ${item.displayName}` : [item.preparation, item.notes].filter(Boolean).join(" · "); const recipe = recipeFor(item, recipes); const inactive = optionPosition !== optionIndex;
        return <div className="nf-food-row-v5" key={item.publicId}><div><strong>{swap?.displayName ?? item.displayName}{swap ? <small className="nf-swap-applied">Trocado</small> : null}</strong>{detail ? <p>{detail}</p> : null}{groups.length || recipe || swap ? <div className="nf-food-actions-v5">{groups.length ? <button type="button" tabIndex={inactive ? -1 : 0} onClick={() => onOpenSwap(item, groups)}>{swap ? "Trocar de novo" : groups[0].title || "Trocar este alimento"}</button> : null}{swap ? <button type="button" tabIndex={inactive ? -1 : 0} onClick={() => onUndoSwap(item.publicId)}>Desfazer</button> : null}{recipe && !swap ? <button type="button" tabIndex={inactive ? -1 : 0} onClick={() => onOpenRecipe(recipe)}>Ver receita</button> : null}</div> : null}</div><b>{swap ? quantity(swap.quantityMilli, swap.unit) : quantity(item.quantityMilli, item.unit)}</b></div>;
      })}{meal.instructions ? <aside className="nf-meal-guidance-v5"><span>Orientação desta refeição</span><p>{meal.instructions}</p></aside> : null}</section>)}
    </div></div>
    {multi ? <div className="nf-plan-swipe-status"><span>{options[optionIndex]?.label}</span><i aria-hidden="true">{options.map((option, index) => <b className={index === optionIndex ? "is-active" : ""} key={option.publicId} />)}</i><small>{optionIndex + 1} de {options.length}</small></div> : null}
  </article>;
}

export default function PatientPlanViewer({ portal, recipes = {}, validUntil }: { portal: PatientPortalV1; recipes?: Readonly<Record<string, ReportRecipeSnapshot>>; validUntil?: string | null }) {
  const [selectedStrategyId, setSelectedStrategyId] = useState(portal.plan?.days[0]?.publicId ?? null);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, SelectedSwap>>({});
  const [optionByMeal, setOptionByMeal] = useState<Record<string, number>>({});
  const [swapSheet, setSwapSheet] = useState<SwapSheetState | null>(null);
  const [recipe, setRecipe] = useState<RecipeContent | null>(null);
  const selectedStrategy = useMemo(() => portal.plan?.days.find((strategy) => strategy.publicId === selectedStrategyId) ?? portal.plan?.days[0] ?? null, [portal.plan, selectedStrategyId]);
  const nutrition = useMemo(() => nutritionFor(selectedStrategy?.meals ?? [], optionByMeal), [optionByMeal, selectedStrategy]);
  const currentId = useMemo(() => currentMealId(selectedStrategy?.meals ?? []), [selectedStrategy]);

  useEffect(() => {
    if (!portal.plan?.publicationPublicId) return;
    const controller = new AbortController();
    void fetch("/api/nutriflow/v1/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", publicationPublicId: portal.plan.publicationPublicId }), cache: "no-store", credentials: "same-origin", signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [portal.plan?.publicationPublicId]);

  function chooseOption(meal: PatientPortalMealV1, index: number) {
    const nextIndex = Math.max(0, Math.min(index, optionsFor(meal).length - 1));
    setOptionByMeal((current) => ({ ...current, [meal.publicId]: nextIndex }));
    setSelectedSwaps((current) => { const next = { ...current }; optionsFor(meal).forEach((option) => option.items.forEach((item) => delete next[item.publicId])); return next; });
  }

  function chooseSwap(group: PatientPortalSubstitutionV1, option: PatientPortalSubstitutionV1["options"][number] | null) {
    if (!swapSheet) return;
    setSelectedSwaps((current) => { const next = { ...current }; if (!option) delete next[swapSheet.item.publicId]; else next[swapSheet.item.publicId] = Object.freeze({ groupPublicId: group.publicId, optionPublicId: option.publicId, displayName: option.displayName, quantityMilli: option.quantityMilli, unit: option.unit }); return next; });
    setSwapSheet(null);
  }

  if (!portal.plan) return <section className="nf-patient-plan-empty"><span aria-hidden="true">◌</span><div><p className="section-kicker">Em preparação</p><h2>Seu plano estruturado aparecerá aqui.</h2><p>Assim que seu nutricionista publicar a estratégia, ela ficará disponível neste espaço.</p><Link className="button button-dark" href="/documentos">Ver documentos atuais</Link></div></section>;

  const printHref = `/api/nutriflow/v1/plan-pdf?strategy=${encodeURIComponent(selectedStrategy?.publicId ?? "")}`;
  return <div className="nf-patient-dashboard nf-plan-v5">
    <section className="nf-plan-overview-v5"><p className="section-kicker">Plano alimentar · versão {portal.plan.versionNumber}</p><h1>{portal.plan.title || "Plano alimentar"}</h1><p>{selectedStrategy?.label || "Estratégia alimentar"}</p><div className="nf-plan-chips-v5">{nutrition.complete ? <><strong>{nutrition.energyKcal} kcal</strong><span>P {nutrition.protein} g</span><span>C {nutrition.carbohydrate} g</span><span>G {nutrition.fat} g</span></> : <span>Cálculo nutricional em revisão</span>}{validUntil ? <span>vigente até {shortDate(validUntil)}</span> : null}</div><a href={printHref} target="_blank" rel="noreferrer">Imprimir ou salvar em PDF ↗</a></section>
    {portal.plan.days.length > 1 ? <nav className="nf-plan-strategies-v5" role="tablist" aria-label="Estratégias do plano alimentar">{portal.plan.days.map((strategy) => <button key={strategy.publicId} type="button" role="tab" aria-selected={strategy.publicId === selectedStrategy?.publicId} onClick={() => setSelectedStrategyId(strategy.publicId)}><strong>{strategy.label}</strong><small>{strategy.meals.length} {strategy.meals.length === 1 ? "refeição" : "refeições"}</small></button>)}</nav> : null}
    {selectedStrategy ? <section className="nf-patient-meals-v5">{selectedStrategy.meals.map((meal) => <MealCard key={meal.publicId} meal={meal} optionIndex={optionByMeal[meal.publicId] ?? 0} current={meal.publicId === currentId} swaps={selectedSwaps} recipes={recipes} onChangeOption={(index) => chooseOption(meal, index)} onOpenSwap={(item, groups) => setSwapSheet(Object.freeze({ item, groups }))} onUndoSwap={(itemPublicId) => setSelectedSwaps((current) => { const next = { ...current }; delete next[itemPublicId]; return next; })} onOpenRecipe={setRecipe} />)}</section> : null}
    {portal.plan.patientNotes.length ? <section className="nf-patient-notes nf-plan-notes-v5"><span>Orientações gerais</span>{portal.plan.patientNotes.map((note, index) => <p key={`${index}-${note.slice(0, 16)}`}>{note}</p>)}</section> : null}
    <details className="nf-plan-more"><summary><span>Mais do seu acompanhamento</span><small>Avaliação, evolução e check-in</small></summary><section className="nf-patient-support-grid"><article><span>Bioimpedância</span><strong>{portal.physicalAssessment.available ? portal.physicalAssessment.title : "Aguardando registro"}</strong><p>{portal.physicalAssessment.available && portal.physicalAssessment.publishedAt ? `Publicada em ${shortDate(portal.physicalAssessment.publishedAt)}.` : "Quando disponibilizado, o exame ficará vinculado ao seu acompanhamento."}</p>{portal.physicalAssessment.href ? <Link href={portal.physicalAssessment.href}>Abrir bioimpedância →</Link> : null}</article><article><span>Evolução de peso</span><WeightTrend values={portal.weightEvolution} /></article><article><span>Check-in periódico</span><strong>{portal.checkIn.status === "completed-this-week" ? "Concluído nesta semana" : "Disponível para preencher"}</strong><p>Seus próximos registros alimentarão a evolução e ajudarão nos ajustes do plano.</p><Link href={portal.checkIn.href}>{portal.checkIn.status === "completed-this-week" ? "Ver histórico" : "Responder check-in"} →</Link></article></section></details>
    {swapSheet ? <SwapSheet state={swapSheet} selected={selectedSwaps[swapSheet.item.publicId] ?? null} onSelect={chooseSwap} onClose={() => setSwapSheet(null)} /> : null}{recipe ? <RecipeScreen recipe={recipe} onClose={() => setRecipe(null)} /> : null}
  </div>;
}
