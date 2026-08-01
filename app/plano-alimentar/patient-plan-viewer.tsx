"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PatientPortalV1 } from "../../modules/nutriflow/contracts/v1/patient-portal.ts";

function quantity(quantityMilli: number, unit: string) {
  const value = quantityMilli / 1000;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
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

export default function PatientPlanViewer({ portal }: { portal: PatientPortalV1 }) {
  const [selectedDayId, setSelectedDayId] = useState(portal.plan?.days[0]?.publicId ?? null);
  const selectedDay = useMemo(() => portal.plan?.days.find((day) => day.publicId === selectedDayId) ?? portal.plan?.days[0] ?? null, [portal.plan, selectedDayId]);

  return <div className="nf-patient-dashboard">
    <section className="nf-patient-hero">
      <div><p className="section-kicker">NutriFlow · seu plano alimentar</p><h1>Olá, {portal.patient.firstName}.</h1><p>Sua estratégia alimentar organizada para consultar de forma simples ao longo do dia.</p></div>
      <aside><span>{portal.patient.modality === "in_person" ? "Acompanhamento presencial" : "Consultoria online"}</span><strong>{portal.plan ? `Plano atualizado em ${shortDate(portal.plan.publishedAt)}` : "Plano em preparação"}</strong><small>Os PDFs atuais continuam disponíveis durante a transição.</small></aside>
    </section>

    {portal.plan ? <>
      <section className="nf-plan-heading">
        <div><span>Versão {portal.plan.versionNumber}</span><h2>{portal.plan.title}</h2>{portal.plan.notes ? <p>{portal.plan.notes}</p> : null}</div>
        <div className="nf-plan-sync"><i aria-hidden="true">✓</i><span>Sincronizado</span><small>Conteúdo publicado pelo nutricionista</small></div>
      </section>

      <nav className="nf-patient-days" aria-label="Dias do plano">
        {portal.plan.days.map((day, index) => <button className={day.publicId === selectedDay?.publicId ? "is-active" : ""} key={day.publicId} type="button" onClick={() => setSelectedDayId(day.publicId)}><small>{String(index + 1).padStart(2, "0")}</small><strong>{day.label}</strong><span>{day.meals.length} refeições</span></button>)}
      </nav>

      {selectedDay ? <section className="nf-patient-day">
        <header><div><span>Organização do dia</span><h2>{selectedDay.label}</h2></div><p>{selectedDay.meals.length} refeição(ões) planejada(s)</p></header>
        <div className="nf-patient-meals">
          {selectedDay.meals.map((meal, index) => <article className="nf-patient-meal" key={meal.publicId}>
            <header><div className="nf-patient-meal-number">{String(index + 1).padStart(2, "0")}</div><div><span>{meal.scheduledTime || "Horário flexível"}</span><h3>{meal.title}</h3></div></header>
            <div className="nf-patient-foods">{meal.items.map((item) => <div className="nf-patient-food" key={item.publicId}><div><strong>{item.displayName}</strong>{item.kind === "recipe" ? <span className="nf-content-badge">Receita</span> : null}<p>{item.preparation || item.notes || "Conforme orientação do plano."}</p></div><b>{quantity(item.quantityMilli, item.unit.label)}</b>{item.recipe ? <details><summary>Ver modo de preparo</summary><p>{item.recipe.instructions || "Siga o preparo indicado pelo nutricionista."}</p></details> : null}</div>)}</div>
            {meal.instructions ? <div className="nf-meal-guidance"><span>Orientação desta refeição</span><p>{meal.instructions}</p></div> : null}
            {meal.substitutions.length ? <details className="nf-substitutions"><summary>Opções de substituição ({meal.substitutions.length})</summary>{meal.substitutions.map((group) => <section key={group.publicId}><h4>{group.title}</h4>{group.notes ? <p>{group.notes}</p> : null}<ul>{group.options.map((option) => <li key={option.publicId}><span>{option.displayName}</span><b>{quantity(option.quantityMilli, option.unit.label)}</b></li>)}</ul></section>)}</details> : null}
          </article>)}
        </div>
      </section> : null}

      {portal.plan.patientNotes.length ? <section className="nf-patient-notes"><span>Orientações importantes</span>{portal.plan.patientNotes.map((note, index) => <p key={`${index}-${note.slice(0, 16)}`}>{note}</p>)}</section> : null}
    </> : <section className="nf-patient-plan-empty"><span aria-hidden="true">◌</span><div><p className="section-kicker">Em preparação</p><h2>Seu plano estruturado aparecerá aqui.</h2><p>Enquanto isso, seus protocolos em PDF continuam disponíveis normalmente na área de documentos.</p><Link className="button button-dark" href="/documentos">Ver documentos atuais</Link></div></section>}

    <section className="nf-patient-support-grid">
      <article><span>Avaliação física</span><strong>{portal.physicalAssessment.available ? portal.physicalAssessment.title : "Aguardando registro"}</strong><p>{portal.physicalAssessment.available && portal.physicalAssessment.publishedAt ? `Publicada em ${shortDate(portal.physicalAssessment.publishedAt)}.` : "Quando disponibilizada, a avaliação ficará vinculada ao seu acompanhamento."}</p>{portal.physicalAssessment.href ? <Link href={portal.physicalAssessment.href}>Abrir avaliação →</Link> : null}</article>
      <article><span>Evolução de peso</span><WeightTrend values={portal.weightEvolution} /></article>
      <article><span>Check-in periódico</span><strong>{portal.checkIn.status === "completed-this-week" ? "Concluído nesta semana" : "Disponível para preencher"}</strong><p>Seus próximos registros alimentarão a evolução e ajudarão nos ajustes do plano.</p><Link href={portal.checkIn.href}>{portal.checkIn.status === "completed-this-week" ? "Ver histórico" : "Responder check-in"} →</Link></article>
    </section>
  </div>;
}

