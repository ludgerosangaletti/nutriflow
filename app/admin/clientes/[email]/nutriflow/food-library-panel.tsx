"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FoodCatalogItemV1, FoodCatalogSearchResultV1 } from "../../../../../modules/nutriflow/contracts/v1/catalog.ts";

type Envelope = { data?: FoodCatalogSearchResultV1; message?: string };
type SearchState = "idle" | "loading" | "ready" | "error";

const categories = [
  { code: "", label: "Todos" },
  { code: "cereals", label: "Cereais e derivados" },
  { code: "vegetables", label: "Verduras e hortaliças" },
  { code: "fruits", label: "Frutas" },
  { code: "fats_oils", label: "Gorduras e óleos" },
  { code: "fish_seafood", label: "Pescados e frutos do mar" },
  { code: "meats", label: "Carnes e derivados" },
  { code: "dairy", label: "Leite e derivados" },
  { code: "beverages", label: "Bebidas" },
  { code: "eggs", label: "Ovos e derivados" },
  { code: "sugars_sweets", label: "Açúcares e doces" },
  { code: "legumes", label: "Leguminosas" },
  { code: "nuts_seeds", label: "Nozes e sementes" },
  { code: "prepared_foods", label: "Alimentos preparados" },
  { code: "industrialized", label: "Industrializados" },
  { code: "miscellaneous", label: "Miscelâneas" },
  { code: "proteins", label: "Seleção clínica · proteínas" },
  { code: "carbohydrates", label: "Seleção clínica · carboidratos" },
  { code: "fats", label: "Seleção clínica · gorduras" },
  { code: "supplements", label: "Suplementos" },
] as const;

const categoryLabels: Record<string, string> = {
  cereals: "Cereais", vegetables: "Verduras e hortaliças", fruits: "Frutas", fats_oils: "Gorduras e óleos", fish_seafood: "Pescados", meats: "Carnes", dairy: "Leite e derivados", beverages: "Bebidas", eggs: "Ovos", sugars_sweets: "Açúcares e doces", legumes: "Leguminosas", nuts_seeds: "Nozes e sementes", prepared_foods: "Preparados", industrialized: "Industrializados", miscellaneous: "Miscelâneas", proteins: "Proteína", carbohydrates: "Carboidrato", fats: "Gordura", supplements: "Suplemento",
};

function reference(item: FoodCatalogItemV1) {
  const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(item.referenceQuantityMilli / 1000);
  return `${quantity} ${item.referenceUnit.code}`;
}

export default function FoodLibraryPanel({ clientId, targetMealTitle, onInsert }: { clientId: number; targetMealTitle: string | null; onInsert: (item: FoodCatalogItemV1) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<readonly FoodCatalogItemV1[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const cache = useRef(new Map<string, readonly FoodCatalogItemV1[]>());

  const cacheKey = useMemo(() => `${query.trim().toLocaleLowerCase("pt-BR")}|${category}`, [query, category]);

  useEffect(() => {
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setState("ready");
      setActiveIndex(0);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const startedAt = performance.now();
      setState("loading");
      setMessage("");
      try {
        const parameters = new URLSearchParams({ clientId: String(clientId), query: query.trim(), limit: "12" });
        if (category) parameters.set("category", category);
        const response = await fetch(`/api/admin/nutriflow/catalog/foods?${parameters}`, { signal: controller.signal, cache: "no-store" });
        const envelope = await response.json().catch(() => ({})) as Envelope;
        if (!response.ok || !envelope.data) throw new Error(envelope.message || "Não foi possível consultar a biblioteca.");
        const items = envelope.data.items;
        if (cache.current.size >= 40) cache.current.delete(cache.current.keys().next().value ?? "");
        cache.current.set(cacheKey, items);
        setResults(items);
        setActiveIndex(0);
        setState("ready");
        console.info("[nutriflow.client.metric]", JSON.stringify({ metric: "catalog.search.duration", durationMs: Math.round(performance.now() - startedAt), resultCount: items.length, queryCount: Number(response.headers.get("x-nutriflow-query-count") ?? 1) }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível consultar a biblioteca.");
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cacheKey, category, clientId, query, retryVersion]);

  function insert(item: FoodCatalogItemV1) {
    if (!targetMealTitle) return;
    onInsert(item);
  }

  return <section className="nutriflow-library" aria-label="Biblioteca Global de Alimentos">
    <header><div><span>Biblioteca global</span><strong>Encontre e inclua alimentos</strong></div><small>v1</small></header>
    <label className="nutriflow-library-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
      if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
      if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); insert(results[activeIndex]); }
    }} placeholder="Buscar banana, frango, arroz…" aria-label="Pesquisar alimento" /></label>
    <label className="nutriflow-library-category"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar alimentos por categoria">{categories.map((item) => <option key={item.code || "all"} value={item.code}>{item.label}</option>)}</select></label>
    <p className={`nutriflow-library-target ${targetMealTitle ? "is-ready" : ""}`}>{targetMealTitle ? <>Adicionando em <strong>{targetMealTitle}</strong></> : "Selecione uma refeição para adicionar."}</p>
    <div className="nutriflow-library-results" aria-busy={state === "loading"}>
      {state === "loading" ? Array.from({ length: 4 }, (_, index) => <span className="nutriflow-library-skeleton" key={index} />) : null}
      {state === "error" ? <button className="nutriflow-library-error" type="button" onClick={() => { cache.current.delete(cacheKey); setRetryVersion((value) => value + 1); }}>{message} Tentar novamente.</button> : null}
      {state === "ready" && results.length === 0 ? <p className="nutriflow-library-empty">Nenhum alimento encontrado. Você ainda pode adicioná-lo manualmente.</p> : null}
      {state === "ready" ? results.map((item, index) => <button className={index === activeIndex ? "is-active" : ""} disabled={!targetMealTitle} key={`${item.publicId}:${item.revisionNumber}`} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => insert(item)}><span><strong>{item.name}</strong><small>{categoryLabels[item.categoryCode ?? ""] ?? "Alimento"} · {reference(item)} {item.source === "taco" ? <em>TACO</em> : item.source === "tbca" ? <em>TBCA</em> : null}</small></span><b aria-hidden="true">＋</b></button>) : null}
    </div>
    <footer><span>Pesquisa por nome e sinônimos</span><span>↑↓ + Enter</span></footer>
  </section>;
}
