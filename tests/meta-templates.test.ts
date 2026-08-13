import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVATION_TEMPLATE_NAME,
  PLAN_READY_TEMPLATE_NAME,
  TRAINING_READY_TEMPLATE_NAME,
  activationTemplateDefinition,
  planReadyTemplateDefinition,
  trainingReadyTemplateDefinition,
  templateSummaries,
} from "../app/meta-templates.ts";

test("modelo de ativação segue o contrato utilitário da Meta", () => {
  const definition = activationTemplateDefinition();
  assert.equal(definition.name, ACTIVATION_TEMPLATE_NAME);
  assert.equal(definition.category, "UTILITY");
  assert.equal(definition.language, "pt_BR");
  assert.equal(definition.components[0].type, "BODY");
  assert.match(definition.components[0].text, /\{\{1\}\}/);
  assert.equal(definition.components[1].buttons[0].type, "URL");
  assert.equal(
    definition.components[1].buttons[0].url,
    "https://ludgerosangaletti.com.br/{{1}}",
  );
});

test("modelos operacionais de dieta e treino são utilitários e levam ao recurso correto", () => {
  const plan = planReadyTemplateDefinition();
  const training = trainingReadyTemplateDefinition();
  assert.equal(plan.name, PLAN_READY_TEMPLATE_NAME);
  assert.equal(training.name, TRAINING_READY_TEMPLATE_NAME);
  assert.equal(plan.category, "UTILITY");
  assert.match(plan.components[0].text, /\{\{1\}\}/);
  assert.equal(plan.components[1].buttons[0].url, "https://ludgerosangaletti.com.br/plano-alimentar");
  assert.equal(training.components[1].buttons[0].url, "https://ludgerosangaletti.com.br/treino");
});

test("resumo descarta campos extras e mantém somente estado operacional", () => {
  const rows = templateSummaries({
    data: [
      {
        id: "123",
        name: "ativacao_conta_presencial_v1",
        status: "PENDING",
        category: "UTILITY",
        language: "pt_BR",
        components: [{ text: "não deve ser exposto" }],
      },
    ],
  });
  assert.deepEqual(rows, [
    {
      id: "123",
      name: "ativacao_conta_presencial_v1",
      status: "PENDING",
      category: "UTILITY",
      language: "pt_BR",
    },
  ]);
});
