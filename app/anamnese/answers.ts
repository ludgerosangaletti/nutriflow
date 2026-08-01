import { sections, type Answers } from "./questions";

const allowedFields = new Set(
  sections.flatMap((section) => section.fields.map((field) => field.id)),
);

export function cleanAnamnesisAnswers(input: unknown): Answers {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key, value]) => allowedFields.has(key) && ["string", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 5000) : value]),
  );
}

export function missingRequiredAnamnesisFields(answers: Answers) {
  return sections
    .flatMap((section) => section.fields)
    .filter((field) => field.required && !answers[field.id])
    .map((field) => field.label);
}
