import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildTrainingAnamnesisSummary } from "../app/treino/anamnese/training-anamnesis-summary.ts";
import { emptyTrainingAnamnesisAnswers } from "../modules/nutriflow/contracts/v1/training-anamnesis.ts";

test("Training completion mirrors only answers actually provided", () => {
  const summary = buildTrainingAnamnesisSummary({
    ...emptyTrainingAnamnesisAnswers(),
    objective: "muscle_gain",
    priorities: ["chest", "back"],
    trainingDaysPerWeek: 4,
    sessionDuration: "45_to_60",
    trainingLocation: "full_gym",
    injuryHistory: false,
  });
  assert.deepEqual(summary, [
    { label: "Objetivo", value: "Ganho de massa muscular", detail: "Prioridade: Peitoral e Costas" },
    { label: "Frequência", value: "4 dias por semana" },
    { label: "Tempo e estrutura", value: "45–60 min por treino", detail: "Academia completa" },
  ]);
});

test("Training completion highlights reported limitations without inventing guidance", () => {
  const summary = buildTrainingAnamnesisSummary({
    ...emptyTrainingAnamnesisAnswers(),
    pain: true,
    painDetails: "Desconforto no ombro direito",
  });
  assert.deepEqual(summary, [
    { label: "Pontos de atenção registrados", value: "Desconforto no ombro direito", attention: true },
  ]);
});

test("Training anamnesis uses a focused shell and avoids unapproved delivery promises", () => {
  const page = readFileSync(new URL("../app/treino/anamnese/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/treino/anamnese/training-anamnesis-form.tsx", import.meta.url), "utf8");
  assert.match(page, /PatientShell hideTabBar/);
  assert.match(form, /Salvo — você pode continuar depois/);
  assert.doesNotMatch(form, /2 dias|prazo|diagn[oó]stico autom[aá]tico/i);
});
