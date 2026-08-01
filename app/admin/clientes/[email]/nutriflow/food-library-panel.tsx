"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FoodCatalogItemV1, FoodCatalogSearchResultV1 } from "../../../../../modules/nutriflow/contracts/v1/catalog.ts";

type Envelope = { data?: FoodCatalogSearchResultV1; message?: string };
type SearchState = "idle" | "loading" | "ready" | "error";

const categories = [
  { code: "", label: "Todos" },
  { code: "proteins", label: "Proteínas" },
  { code: "carbohydrates", label: "Carboidratos" },
  { code: "fruits", label: "Frutas" },
  { code: "vegetables", label: "Vegetais" },
] as const;

const categoryLabels: Record<string, string> = {
  proteins: "Proteína", carbohydrates: "Carboidrato", fruits: "Fruta", vegetables: "Vegetal", legumes: "Leguminosa", dairy: "Lácteo", fats: "Gordura", supplements: "Suplemento",
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
    <div className="nutriflow-library-categories" aria-label="Categorias">{categories.map((item) => <button className={category === item.code ? "is-active" : ""} key={item.code || "all"} type="button" onClick={() => setCategory(item.code)}>{item.label}</button>)}</div>
    <p className={`nutriflow-library-target ${targetMealTitle ? "is-ready" : ""}`}>{targetMealTitle ? <>Adicionando em <strong>{targetMealTitle}</strong></> : "Selecione uma refeição para adicionar."}</p>
    <div className="nutriflow-library-results" aria-busy={state === "loading"}>
      {state === "loading" ? Array.from({ length: 4 }, (_, index) => <span className="nutriflow-library-skeleton" key={index} />) : null}
      {state === "error" ? <button className="nutriflow-library-error" type="button" onClick={() => { cache.current.delete(cacheKey); setRetryVersion((value) => value + 1); }}>{message} Tentar novamente.</button> : null}
      {state === "ready" && results.length === 0 ? <p className="nutriflow-library-empty">Nenhum alimento encontrado. Você ainda pode adicioná-lo manualmente.</p> : null}
      {state === "ready" ? results.map((item, index) => <button className={index === activeIndex ? "is-active" : ""} disabled={!targetMealTitle} key={`${item.publicId}:${item.revisionNumber}`} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => insert(item)}><span><strong>{item.name}</strong><small>{categoryLabels[item.categoryCode ?? ""] ?? "Alimento"} · {reference(item)}</small></span><b aria-hidden="true">＋</b></button>) : null}
    </div>
    <footer><span>Pesquisa por nome e sinônimos</span><span>↑↓ + Enter</span></footer>
  </section>;
}
