import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? "drizzle/0029_nutriflow_taco_catalog.sql";
if (!sourcePath) throw new Error("Informe o JSON extraído da planilha oficial TACO.");

const rows = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const SOURCE_URL = "https://www.nepa.unicamp.br/arquivo/uploads/taco-4a-edicao/taco-4a-edicao-2/";
const SOURCE_SHA256 = "a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14";
const IMPORTED_AT = "2026-08-02T00:00:00.000Z";

const categories = new Map([
  ["Cereais e derivados", ["cereals", "Cereais e derivados", 10]],
  ["Verduras, hortaliças e derivados", ["vegetables", "Verduras e hortaliças", 20]],
  ["Frutas e derivados", ["fruits", "Frutas e derivados", 30]],
  ["Gorduras e óleos", ["fats_oils", "Gorduras e óleos", 40]],
  ["Pescados e frutos do mar", ["fish_seafood", "Pescados e frutos do mar", 50]],
  ["Carnes e derivados", ["meats", "Carnes e derivados", 60]],
  ["Leite e derivados", ["dairy", "Leite e derivados", 70]],
  ["Bebidas (alcoólicas e não alcoólicas)", ["beverages", "Bebidas", 80]],
  ["Ovos e derivados", ["eggs", "Ovos e derivados", 90]],
  ["Produtos açucarados", ["sugars_sweets", "Açúcares e doces", 100]],
  ["Miscelâneas", ["miscellaneous", "Miscelâneas", 110]],
  ["Outros alimentos industrializados", ["industrialized", "Alimentos industrializados", 120]],
  ["Alimentos preparados", ["prepared_foods", "Alimentos preparados", 130]],
  ["Leguminosas e derivados", ["legumes", "Leguminosas e derivados", 140]],
  ["Nozes e sementes", ["nuts_seeds", "Nozes e sementes", 150]],
]);

const nutrients = [
  [2, "moisture", "Umidade", "g"],
  [3, "energy_kcal", "Energia", "kcal"],
  [4, "energy_kj", "Energia", "kJ"],
  [5, "protein", "Proteína", "g"],
  [6, "lipids", "Lipídeos", "g"],
  [7, "cholesterol", "Colesterol", "mg"],
  [8, "carbohydrate", "Carboidrato", "g"],
  [9, "fiber", "Fibra alimentar", "g"],
  [10, "ash", "Cinzas", "g"],
  [11, "calcium", "Cálcio", "mg"],
  [12, "magnesium", "Magnésio", "mg"],
  [14, "manganese", "Manganês", "mg"],
  [15, "phosphorus", "Fósforo", "mg"],
  [16, "iron", "Ferro", "mg"],
  [17, "sodium", "Sódio", "mg"],
  [18, "potassium", "Potássio", "mg"],
  [19, "copper", "Cobre", "mg"],
  [20, "zinc", "Zinco", "mg"],
  [21, "retinol", "Retinol", "ug"],
  [22, "retinol_equivalent", "Equivalente de retinol", "ug"],
  [23, "retinol_activity_equivalent", "Equivalente de atividade de retinol", "ug"],
  [24, "thiamin", "Tiamina", "mg"],
  [25, "riboflavin", "Riboflavina", "mg"],
  [26, "pyridoxine", "Piridoxina", "mg"],
  [27, "niacin", "Niacina", "mg"],
  [28, "vitamin_c", "Vitamina C", "mg"],
];

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function unaccent(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const synonymRules = [
  [/mandioca|aipim/i, ["mandioca", "aipim", "macaxeira"]],
  [/tangerina/i, ["tangerina", "mexerica", "bergamota"]],
  [/pão, francês|pão francês/i, ["pão francês", "pao frances", "pão de sal", "pao de sal", "cacetinho"]],
  [/batata, baroa|mandioquinha/i, ["batata baroa", "mandioquinha", "batata salsa"]],
  [/abóbora/i, ["abóbora", "abobora", "jerimum"]],
  [/feijão, fradinho/i, ["feijão fradinho", "feijao fradinho", "feijão de corda", "feijao de corda", "caupi"]],
  [/refrigerante/i, ["refrigerante", "refri"]],
];

function aliases(name) {
  const values = new Set([unaccent(name).toLocaleLowerCase("pt-BR")]);
  const base = name.split(",")[0]?.trim();
  if (base && base.length > 2) values.add(unaccent(base).toLocaleLowerCase("pt-BR"));
  for (const [pattern, synonyms] of synonymRules) if (pattern.test(name)) for (const synonym of synonyms) values.add(synonym);
  values.delete(name.toLocaleLowerCase("pt-BR"));
  return [...values];
}

const foods = [];
let currentCategory = null;
for (const row of rows.slice(3)) {
  if (typeof row[0] === "string" && categories.has(row[0])) {
    currentCategory = categories.get(row[0]);
    continue;
  }
  if (!Number.isFinite(row[0]) || !currentCategory) continue;
  foods.push({ code: Number(row[0]), name: String(row[1]).trim(), categoryCode: currentCategory[0], row });
}
if (foods.length !== 597) throw new Error(`Esperados 597 alimentos TACO; encontrados ${foods.length}.`);

function chunks(values, size = 80) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

const statements = [];
statements.push(`CREATE TABLE IF NOT EXISTS \`nf_food_data_sources\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`public_id\` text NOT NULL,
  \`code\` text NOT NULL,
  \`version\` text NOT NULL,
  \`name\` text NOT NULL,
  \`source_url\` text NOT NULL,
  \`file_sha256\` text,
  \`usage_status\` text NOT NULL,
  \`terms_note\` text NOT NULL,
  \`imported_at\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);`);
statements.push("CREATE UNIQUE INDEX IF NOT EXISTS `nf_food_data_sources_public_id_unique` ON `nf_food_data_sources` (`public_id`);");
statements.push("CREATE UNIQUE INDEX IF NOT EXISTS `nf_food_data_sources_code_version_unique` ON `nf_food_data_sources` (`code`,`version`);");
statements.push(`CREATE TABLE IF NOT EXISTS \`nf_food_categories\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`code\` text NOT NULL,
  \`label\` text NOT NULL,
  \`source_group\` text,
  \`sort_order\` integer NOT NULL,
  \`status\` text DEFAULT 'active' NOT NULL,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);`);
statements.push("CREATE UNIQUE INDEX IF NOT EXISTS `nf_food_categories_code_unique` ON `nf_food_categories` (`code`);");
statements.push(`INSERT OR IGNORE INTO \`nf_food_data_sources\` (\`public_id\`,\`code\`,\`version\`,\`name\`,\`source_url\`,\`file_sha256\`,\`usage_status\`,\`terms_note\`,\`imported_at\`) VALUES
  ('foodsource_taco_4', 'taco', '4a-edicao', 'Tabela Brasileira de Composição de Alimentos — TACO', ${sql(SOURCE_URL)}, '${SOURCE_SHA256}', 'active_internal_clinical_use', 'Fonte oficial NEPA/Unicamp; manter atribuição e validar condições antes de redistribuição comercial da base.', '${IMPORTED_AT}'),
  ('foodsource_tbca_7_3', 'tbca', '7.3', 'Tabela Brasileira de Composição de Alimentos — TBCA', 'https://www.tbca.net.br/', NULL, 'blocked_pending_commercial_authorization', 'Estrutura preparada; importação bloqueada até autorização comercial formal dos coordenadores da TBCA.', NULL);`);
statements.push(`INSERT OR IGNORE INTO \`nf_food_categories\` (\`code\`,\`label\`,\`source_group\`,\`sort_order\`) VALUES\n${[...categories.entries()].map(([group, [code, label, order]]) => `  (${sql(code)}, ${sql(label)}, ${sql(group)}, ${order})`).join(",\n")};`);
statements.push(`INSERT OR IGNORE INTO \`nf_nutrients\` (\`public_id\`,\`code\`,\`name\`,\`unit_code\`,\`amount_scale\`,\`status\`) VALUES\n${nutrients.map(([, code, name, unit]) => `  (${sql(`nutrient_${code}`)}, ${sql(code)}, ${sql(name)}, ${sql(unit)}, 1000, 'active')`).join(",\n")};`);

for (const batch of chunks(foods)) {
  statements.push(`WITH \`catalog\` (\`public_id\`,\`external_code\`) AS (VALUES\n${batch.map((food) => `  (${sql(`food_taco_${String(food.code).padStart(4, "0")}`)}, ${sql(String(food.code))})`).join(",\n")})
INSERT OR IGNORE INTO \`nf_foods\` (\`public_id\`,\`organization_id\`,\`scope\`,\`source\`,\`external_code\`,\`status\`,\`created_by_auth_user_id\`)
SELECT \`public_id\`, NULL, 'global', 'taco', \`external_code\`, 'active', 'system:taco-import' FROM \`catalog\`;`);

  statements.push(`WITH \`catalog\` (\`food_public_id\`,\`revision_public_id\`,\`name\`,\`category_code\`,\`aliases_json\`,\`source_metadata_json\`) AS (VALUES\n${batch.map((food) => {
    const metadata = { sourceCode: "taco", sourceVersion: "4a-edicao", externalCode: String(food.code), referenceBase: "100 g de parte comestível", sourceUrl: SOURCE_URL, fileSha256: SOURCE_SHA256, importedAt: IMPORTED_AT, valueSemantics: { trace: "amount_scaled=0 and source=taco:trace", unavailable: "nutrient row omitted" } };
    return `  (${sql(`food_taco_${String(food.code).padStart(4, "0")}`)}, ${sql(`foodrev_taco_${String(food.code).padStart(4, "0")}_v1`)}, ${sql(food.name)}, ${sql(food.categoryCode)}, ${sql(JSON.stringify(aliases(food.name)))}, ${sql(JSON.stringify(metadata))})`;
  }).join(",\n")})
INSERT OR IGNORE INTO \`nf_food_revisions\` (\`public_id\`,\`food_id\`,\`revision_number\`,\`state\`,\`name\`,\`category_code\`,\`aliases_json\`,\`reference_quantity_milli\`,\`reference_unit_id\`,\`source_metadata_json\`,\`created_by_auth_user_id\`,\`released_by_auth_user_id\`,\`released_at\`)
SELECT \`catalog\`.\`revision_public_id\`, \`food\`.\`id\`, 1, 'released', \`catalog\`.\`name\`, \`catalog\`.\`category_code\`, \`catalog\`.\`aliases_json\`, 100000, \`unit\`.\`id\`, \`catalog\`.\`source_metadata_json\`, 'system:taco-import', 'system:taco-import', '${IMPORTED_AT}'
FROM \`catalog\`
INNER JOIN \`nf_foods\` AS \`food\` ON \`food\`.\`public_id\` = \`catalog\`.\`food_public_id\`
INNER JOIN \`nf_units\` AS \`unit\` ON \`unit\`.\`public_id\` = 'unit_gram';`);
}

const nutrientRows = [];
for (const food of foods) {
  for (const [column, code] of nutrients) {
    const raw = food.row[column];
    if (raw === null || raw === undefined || raw === "" || String(raw).toUpperCase() === "NA") continue;
    const trace = typeof raw === "string" && raw.trim().toLocaleLowerCase("pt-BR") === "tr";
    if (!trace && !Number.isFinite(raw)) continue;
    nutrientRows.push({ foodCode: food.code, nutrientCode: code, amountScaled: trace ? 0 : Math.round(Number(raw) * 1000), source: trace ? "taco:trace" : "taco:value" });
  }
}
for (const batch of chunks(nutrientRows, 100)) {
  statements.push(`WITH \`values_to_import\` (\`revision_public_id\`,\`nutrient_code\`,\`amount_scaled\`,\`source\`) AS (VALUES\n${batch.map((value) => `  (${sql(`foodrev_taco_${String(value.foodCode).padStart(4, "0")}_v1`)}, ${sql(value.nutrientCode)}, ${value.amountScaled}, ${sql(value.source)})`).join(",\n")})
INSERT OR IGNORE INTO \`nf_food_nutrients\` (\`food_revision_id\`,\`nutrient_id\`,\`amount_scaled\`,\`source\`)
SELECT \`revision\`.\`id\`, \`nutrient\`.\`id\`, \`values_to_import\`.\`amount_scaled\`, \`values_to_import\`.\`source\`
FROM \`values_to_import\`
INNER JOIN \`nf_food_revisions\` AS \`revision\` ON \`revision\`.\`public_id\` = \`values_to_import\`.\`revision_public_id\`
INNER JOIN \`nf_nutrients\` AS \`nutrient\` ON \`nutrient\`.\`code\` = \`values_to_import\`.\`nutrient_code\`;`);
}

statements.push("CREATE INDEX IF NOT EXISTS `nf_food_revisions_category_name_idx` ON `nf_food_revisions` (`category_code`, `name` COLLATE NOCASE);");
statements.push("CREATE INDEX IF NOT EXISTS `nf_foods_source_status_idx` ON `nf_foods` (`source`, `status`, `external_code`);");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${statements.join("\n--> statement-breakpoint\n")}\n`);
console.log(JSON.stringify({ foods: foods.length, nutrients: nutrients.length, nutrientValues: nutrientRows.length, categories: categories.size, outputPath }));
