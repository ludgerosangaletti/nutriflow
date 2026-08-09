"use client";

import { useState } from "react";
import type { PatientTrainingPortalV1, TrainingWeekday } from "../../modules/nutriflow/contracts/v1/training.ts";

const days: readonly Readonly<{ key: TrainingWeekday; label: string }>[] = [
  { key: "mon", label: "SEG" }, { key: "tue", label: "TER" }, { key: "wed", label: "QUA" }, { key: "thu", label: "QUI" }, { key: "fri", label: "SEX" }, { key: "sat", label: "SÁB" }, { key: "sun", label: "DOM" },
];

type ExerciseSnapshot = NonNullable<PatientTrainingPortalV1["publication"]>["content"]["days"][number]["muscleGroups"][number]["exercises"][number]["exercise"];
type Exercise = NonNullable<PatientTrainingPortalV1["publication"]>["content"]["days"][number]["muscleGroups"][number]["exercises"][number];

function execution(item: Exercise) {
  const prescription = item.prescription;
  const repetitions = prescription.repetitions ? prescription.repetitions.min === prescription.repetitions.max ? `${prescription.repetitions.min} repetições` : `${prescription.repetitions.min}–${prescription.repetitions.max} repetições` : null;
  return [prescription.sets ? `${prescription.sets} séries` : null, repetitions ?? (prescription.durationSeconds ? `${prescription.durationSeconds}s` : null)].filter(Boolean).join(" · ");
}

function mediaUrl(publicationPublicId: string, mediaPublicId: string, variant: "poster" | "video") {
  return `/api/treino/midia?publication=${encodeURIComponent(publicationPublicId)}&media=${encodeURIComponent(mediaPublicId)}&variant=${variant}`;
}

function ExerciseMedia({ exercise, publicationPublicId }: Readonly<{ exercise: ExerciseSnapshot; publicationPublicId: string }>) {
  const [showVideo, setShowVideo] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  if (!exercise.mediaPublicId || unavailable) return <div className="training-patient-placeholder" aria-label={`Demonstração indisponível de ${exercise.name}`}><span>△</span><small>Demonstração indisponível</small></div>;
  const poster = mediaUrl(publicationPublicId, exercise.mediaPublicId, "poster");
  if (showVideo && exercise.mediaKind === "video") return <div className="training-patient-media"><video controls autoPlay muted playsInline loop preload="metadata" poster={poster} onError={() => setUnavailable(true)}><source src={mediaUrl(publicationPublicId, exercise.mediaPublicId, "video")} type="video/mp4" /></video><button type="button" onClick={() => setShowVideo(false)}>Voltar ao poster</button></div>;
  if (showVideo && exercise.mediaKind === "gif") return <div className="training-patient-media"><img src={mediaUrl(publicationPublicId, exercise.mediaPublicId, "video")} alt={`Demonstração de ${exercise.name}`} onError={() => setUnavailable(true)} /><button type="button" onClick={() => setShowVideo(false)}>Voltar ao poster</button></div>;
  return <button className="training-patient-poster" type="button" onClick={() => setShowVideo(true)} aria-label={`Ver demonstração de ${exercise.name}`}><img src={poster} alt={`Poster de ${exercise.name}`} loading="lazy" onError={() => setUnavailable(true)} /><span>Ver demonstração</span></button>;
}

export default function TrainingPatientViewer({ portal }: Readonly<{ portal: PatientTrainingPortalV1 }>) {
  const [selected, setSelected] = useState<TrainingWeekday>(portal.currentWeekday);
  const day = portal.publication?.content.days.find((entry) => entry.weekday === selected) ?? null;
  const publicationPublicId = portal.publication?.publicId ?? "";
  return <main className="training-patient-screen">
    <header className="training-patient-heading"><p>NutriFlow Training</p><h1>{selected === portal.currentWeekday ? portal.card.title : "Seu treino"}</h1><span>{selected === portal.currentWeekday ? portal.card.subtitle : days.find((entry) => entry.key === selected)?.label}</span></header>
    <nav className="training-patient-days" aria-label="Dias da rotina">{days.map((entry) => <button key={entry.key} type="button" onClick={() => setSelected(entry.key)} className={selected === entry.key ? "is-active" : ""}>{entry.label}</button>)}</nav>
    {!day?.muscleGroups.length ? <section className="training-patient-rest"><span>◌</span><h2>Dia de descanso</h2><p>Hoje não há exercícios prescritos. Aproveite para recuperar o corpo e retome no próximo treino.</p></section> : <section className="training-patient-groups">{day.muscleGroups.map((group) => <section key={group.publicId}><header><p>Grupamento</p><h2>{group.name}</h2></header><div>{group.exercises.map((item, index) => <article className="training-patient-exercise" key={item.publicId}><ExerciseMedia exercise={item.exercise} publicationPublicId={publicationPublicId} /><div className="training-patient-copy"><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.exercise.name}</h3><strong>{execution(item)}</strong>{item.prescription.restSeconds !== null ? <small>Descanso · {item.prescription.restSeconds}s</small> : null}{item.prescription.notes ? <p>{item.prescription.notes}</p> : null}</div></article>)}</div></section>)}</section>}
  </main>;
}
