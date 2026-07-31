import assert from "node:assert/strict";
import test from "node:test";
import {
  NutriFlowContractError,
  createNutriFlowApiErrorV1,
  parseCreateFoodPlanCommandV1,
  parseGetPublishedFoodPlanQueryV1,
  parsePublishedFoodPlanV1,
  parseSaveFoodPlanDraftCommandV1,
} from "../modules/nutriflow/contracts/v1/validation.ts";

const content = {
  schemaVersion: 1,
  days: [{ publicId: "day_01", label: "Dia padrão", dayIndex: null, sortOrder: 0 }],
  meals: [
    {
      publicId: "meal_01",
      planDayPublicId: "day_01",
      title: "Café da manhã",
      scheduledTime: "08:00",
      instructions: null,
      sortOrder: 0,
      items: [
        {
          publicId: "item_01",
          source: { type: "manual", publicId: null, revisionNumber: null },
          displayName: "Banana",
          quantityMilli: 1000,
          unit: { publicId: "unit_01", code: "un", label: "unidade" },
          preparation: null,
          notes: null,
          sortOrder: 0,
        },
      ],
    },
  ],
  notes: [],
};

test("v1 command validation returns an immutable mapped contract", () => {
  const command = parseSaveFoodPlanDraftCommandV1({
    apiVersion: "v1",
    planPublicId: "plan_01",
    planVersionPublicId: "version_01",
    expectedRevision: 2,
    title: " Plano alimentar ",
    planNotes: null,
    content,
    correlationId: "corr_contract_01",
    ignoredTransportField: "must not leak",
  });

  assert.equal(command.title, "Plano alimentar");
  assert.equal("ignoredTransportField" in command, false);
  assert.equal(Object.isFrozen(command), true);
  assert.equal(Object.isFrozen(command.content.meals[0].items), true);
});

test("unsupported API versions and invalid nested quantities are rejected", () => {
  assert.throws(
    () =>
      parseCreateFoodPlanCommandV1({
        apiVersion: "v2",
        clientId: 1,
        title: "Plano",
        correlationId: "corr_contract_02",
      }),
    (error) => error instanceof NutriFlowContractError && error.path === "apiVersion",
  );

  assert.throws(
    () =>
      parseSaveFoodPlanDraftCommandV1({
        apiVersion: "v1",
        planPublicId: "plan_01",
        planVersionPublicId: "version_01",
        expectedRevision: 2,
        title: "Plano",
        planNotes: null,
        content: {
          ...content,
          meals: [
            {
              ...content.meals[0],
              items: [{ ...content.meals[0].items[0], quantityMilli: 0 }],
            },
          ],
        },
        correlationId: "corr_contract_03",
      }),
    (error) =>
      error instanceof NutriFlowContractError &&
      error.path === "content.meals.0.items.0.quantityMilli",
  );
});

test("patient query contract accepts only the published resource identifier", () => {
  const query = parseGetPublishedFoodPlanQueryV1({
    apiVersion: "v1",
    publicationPublicId: "publication_01",
    correlationId: "corr_contract_04",
    clientId: 999,
  });

  assert.deepEqual(query, {
    apiVersion: "v1",
    publicationPublicId: "publication_01",
    correlationId: "corr_contract_04",
  });
});

test("published DTO and safe error envelope are runtime validated", () => {
  const published = parsePublishedFoodPlanV1({
    apiVersion: "v1",
    publicationPublicId: "publication_01",
    planPublicId: "plan_01",
    planVersionPublicId: "version_01",
    clientId: 1,
    versionNumber: 1,
    contentHash: "sha256:content",
    publishedAt: "2026-07-31T12:00:00.000Z",
    content,
  });
  const error = createNutriFlowApiErrorV1(
    "NF_VERSION_CONFLICT",
    "corr_contract_05",
    { expectedRevision: 2 },
  );

  assert.equal(published.apiVersion, "v1");
  assert.equal(error.errorCode, "NF_VERSION_CONFLICT");
  assert.equal(error.message, "O conteúdo foi atualizado em outro local.");
  assert.equal(Object.isFrozen(error.details), true);
  assert.equal(JSON.stringify(error).includes("database"), false);
});
