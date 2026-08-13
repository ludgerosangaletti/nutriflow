import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPatientDocumentItems, formatDocumentSize, isRecentlyPublished } from "../app/documentos/document-model.ts";

const now = new Date("2026-08-13T12:00:00.000Z").getTime();

test("documentos reúne a avaliação atual, recolhe o histórico e mantém o plano fora da lista", () => {
  const documents = buildPatientDocumentItems({
    now,
    assessments: [
      { publicId: "assessment_1", capturedAt: "2026-04-08T12:00:00.000Z" },
      { publicId: "assessment_2", capturedAt: "2026-08-10T12:00:00.000Z" },
    ],
    storedDocuments: [
      { id: 1, documentType: "protocol", title: "Plano alimentar PDF", version: "3", sizeBytes: 800_000, isCurrent: true, publishedAt: "2026-08-12T12:00:00.000Z" },
      { id: 2, documentType: "physical_assessment", title: "Bioimpedância", version: "2", sizeBytes: 1_153_434, isCurrent: true, publishedAt: "2026-08-11T12:00:00.000Z" },
      { id: 3, documentType: "physical_assessment", title: "Bioimpedância", version: "1", sizeBytes: 640_000, isCurrent: false, publishedAt: "2026-05-11T12:00:00.000Z" },
    ],
  });
  assert.equal(documents.length, 2);
  assert.equal(documents[0].kind, "bioimpedance");
  assert.equal(documents[0].sizeLabel, "1,1 MB");
  assert.equal(documents[0].versions.length, 1);
  assert.equal(documents[1].kind, "assessment");
  assert.equal(documents[1].title, "Avaliação física - 2ª");
  assert.equal(documents[1].versions[0].label, "1ª avaliação");
  assert.ok(documents.every((document) => !document.title.includes("Plano alimentar")));
});

test("selo novo e tamanho são derivados sem persistência adicional", () => {
  assert.equal(isRecentlyPublished("2026-08-10T12:00:00.000Z", now), true);
  assert.equal(isRecentlyPublished("2026-08-01T12:00:00.000Z", now), false);
  assert.equal(formatDocumentSize(620 * 1024), "620 KB");
  assert.equal(formatDocumentSize(0), undefined);
});

test("listagem extensa preserva os documentos e a ordenação mensal", () => {
  const documents = buildPatientDocumentItems({
    now,
    assessments: [],
    storedDocuments: Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      documentType: "auxiliary",
      title: `Material ${String(index + 1).padStart(2, "0")}`,
      version: "1",
      sizeBytes: 80_000 + index,
      isCurrent: true,
      publishedAt: new Date(Date.UTC(2026, index % 3 + 4, index + 1, 12)).toISOString(),
    })),
  });
  assert.equal(documents.length, 16);
  assert.ok(documents.every((document) => document.kind === "other"));
  assert.ok(documents.every((document, index) => index === 0 || documents[index - 1].publishedAt >= document.publishedAt));
});

test("listagem e visualização preservam organização, titularidade e vigência", () => {
  const page = readFileSync(new URL("../app/documentos/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/documentos/[id]/route.ts", import.meta.url), "utf8");
  assert.match(page, /eq\(nfClinicalAssessments\.organizationId, client\.organizationId\)/);
  assert.match(page, /eq\(patientDocuments\.clientEmail, client\.email\)/);
  assert.match(route, /user\.email\.toLowerCase\(\) !== document\.clientEmail\.toLowerCase\(\)/);
  assert.match(route, /hasActiveAccess\(client\)/);
  assert.match(route, /searchParams\.get\("mode"\) === "inline"/);
});
