import Link from "next/link";
import type { ComponentType } from "react";
import type { TrainingPatientAccessStateV1 } from "../../modules/nutriflow/contracts/v1/training.ts";
import { IconCheckin, IconDocumentos, IconEvolucao, IconPlano, IconTreino } from "./QuickAccessIcons";

type Icon = ComponentType<Readonly<{ size?: number; active?: boolean }>>;
type Item = Readonly<{ href: string; icon: Icon; title: string; subtitle: string; primary?: boolean }>;

function QuickAccessCard({ item }: Readonly<{ item: Item }>) {
  const Icon = item.icon;
  return (
    <Link className={`nf-quick-card nf-pressable${item.primary ? " is-primary" : ""}`} href={item.href}>
      <i aria-hidden="true"><Icon /></i>
      <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function QuickAccessRow({ item }: Readonly<{ item: Item }>) {
  const Icon = item.icon;
  return <Link className="nf-quick-row nf-pressable" href={item.href}><i aria-hidden="true"><Icon size={19} /></i><span>{item.title}</span><b aria-hidden="true">→</b></Link>;
}

function TrainingOfferCard() {
  return (
    <Link className="nf-training-offer-card nf-pressable" href="/treino-info">
      <span>Ainda não incluso</span>
      <i aria-hidden="true"><IconTreino /></i>
      <strong>Acompanhamento de treino</strong>
      <small>Conheça como funciona</small>
    </Link>
  );
}

export function QuickAccess(props: Readonly<{
  training: TrainingPatientAccessStateV1;
  structuredPlanEnabled: boolean;
  documentsCount: number;
  checkInDone: boolean;
  checkInAvailable: boolean;
  photosCount: number;
}>) {
  const commercial = props.training.state === "commercial";
  const cards: Item[] = [];

  if (!commercial) cards.push({ href: "/treino", icon: IconTreino, title: props.training.title, subtitle: props.training.subtitle, primary: props.training.state === "today" });
  if (props.structuredPlanEnabled) cards.push({ href: "/plano-alimentar", icon: IconPlano, title: "Plano alimentar", subtitle: "Refeições do dia", primary: true });
  cards.push({ href: "/check-in", icon: IconCheckin, title: "Check-in", subtitle: props.checkInDone ? "Enviado nesta semana" : props.checkInAvailable ? "Disponível hoje" : "Abre na segunda-feira" });
  cards.push({ href: "/documentos", icon: IconDocumentos, title: "Documentos", subtitle: props.documentsCount ? `${props.documentsCount} disponível(is)` : "Protocolos e avaliações" });

  const evolution: Item = { href: "/evolucao", icon: IconEvolucao, title: "Evolução", subtitle: props.photosCount ? `${props.photosCount} foto(s)` : "Registro opcional" };
  const evolutionInGrid = cards.length % 2 === 1;
  if (evolutionInGrid) cards.push(evolution);

  return (
    <section className="nf-quick-access" aria-labelledby="quick-access-title">
      <header><span id="quick-access-title">Acessos rápidos</span><small>O que você precisa agora?</small></header>
      <div className="nf-quick-grid">{cards.map((item) => <QuickAccessCard item={item} key={item.href} />)}</div>
      {!evolutionInGrid ? <QuickAccessRow item={evolution} /> : null}
      {commercial ? <TrainingOfferCard /> : null}
    </section>
  );
}
