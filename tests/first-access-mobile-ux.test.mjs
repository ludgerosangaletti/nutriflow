import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/primeiro-acesso/page.tsx", import.meta.url), "utf8");

test("conclusão do cadastro preserva uma coluna centralizada em celular e tablet", () => {
  assert.match(page, /first-access-page/);
  assert.match(page, /first-access-grid/);
  assert.match(css, /@media \(max-width: 850px\)[\s\S]*?\.first-access-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.first-access-grid\s*>\s*\*[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.first-access-page\s*\{[\s\S]*?overflow-x:\s*clip/);
});

test("formulário móvel cabe no viewport e evita zoom automático dos campos", () => {
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.in-person-profile-form\s*\{[\s\S]*?padding:\s*22px 18px/);
  assert.match(css, /\.profile-name-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.in-person-profile-form input:not\(\[type="checkbox"\]\)[\s\S]*?font-size:\s*16px/);
  assert.match(css, /body:has\(\.first-access-page\) \.mobile-app-banner/);
});
