import { createHash } from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const BASE_URL = "https://www.tbca.net.br/base-dados";
const SOURCE_URL = "https://www.tbca.net.br/";
const SOURCE_VERSION = "7.3";
const IMPORTED_AT = "2026-08-13T00:00:00.000Z";
const CACHE_PATH = process.argv[2] ?? "data/tbca-7.3-macros.json";
const OUTPUT_PATH = process.argv[3] ?? "drizzle/0047_nutriflow_tbca_7_3.sql";
const CONCURRENCY = Math.max(1, Math.min(Number(process.env.TBCA_CONCURRENCY ?? 16), 24));
const MIRROR_PATH = process.env.TBCA_MIRROR_PATH ?? null;
const MIRROR_URL = process.env.TBCA_MIRROR_URL ?? null;
const MIRROR_CAPTURED_AT = process.env.TBCA_MIRROR_CAPTURED_AT ?? null;

const categories = new Map([
  ["Açúcares e doces", ["sugars_sweets", "Açúcares e doces", 100]],
  ["Alimentos industrializados", ["industrialized", "Alimentos industrializados", 120]],
  ["Alimentos para fins especiais", ["industrialized", "Alimentos industrializados", 120]],
  ["Bebidas", ["beverages", "Bebidas", 80]],
  ["Carnes e derivados", ["meats", "Carnes e derivados", 60]],
  ["Cereais e derivados", ["cereals", "Cereais e derivados", 10]],
  ["Fast food", ["prepared_foods", "Alimentos preparados", 130]],
  ["Frutas e derivados", ["fruits", "Frutas e derivados", 30]],
  ["Gorduras e óleos", ["fats_oils", "Gorduras e óleos", 40]],
  ["Leguminosas e derivados", ["legumes", "Leguminosas e derivados", 140]],
  ["Leite e derivados", ["dairy", "Leite e derivados", 70]],
  ["Miscelâneas", ["miscellaneous", "Miscelâneas", 110]],
  ["Nozes e sementes", ["nuts_seeds", "Nozes e sementes", 150]],
  ["Ovos e derivados", ["eggs", "Ovos e derivados", 90]],
  ["Pescados e frutos do mar", ["fish_seafood", "Pescados e frutos do mar", 50]],
  ["Refeições completas", ["prepared_foods", "Alimentos preparados", 130]],
  ["Vegetais e derivados", ["vegetables", "Verduras e hortaliças", 20]],
]);

const groupByCodeSuffix = new Map([
  ["A", "Cereais e derivados"],
  ["B", "Vegetais e derivados"],
  ["C", "Frutas e derivados"],
  ["D", "Gorduras e óleos"],
  ["E", "Pescados e frutos do mar"],
  ["F", "Carnes e derivados"],
  ["G", "Leite e derivados"],
  ["H", "Bebidas"],
  ["J", "Ovos e derivados"],
  ["K", "Açúcares e doces"],
  ["L", "Miscelâneas"],
  ["M", "Fast food"],
  ["N", "Alimentos para fins especiais"],
  ["R", "Alimentos industrializados"],
  ["S", "Refeições completas"],
  ["T", "Leguminosas e derivados"],
  ["U", "Nozes e sementes"],
]);

const nutrientRules = new Map([
  ["energia|kcal", "energy_kcal"],
  ["proteina|g", "protein"],
  ["carboidrato disponivel|g", "carbohydrate"],
  ["lipidios|g", "lipids"],
  ["fibra alimentar|g", "fiber"],
]);

const namedEntities = Object.freeze({
  amp: "&", apos: "'", quot: '"', nbsp: " ", lt: "<", gt: ">",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  agrave: "à", atilde: "ã", otilde: "õ", acirc: "â", ecirc: "ê", ocirc: "ô",
  ccedil: "ç", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  Atilde: "Ã", Otilde: "Õ", Ccedil: "Ç",
});

function decodeHtml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/g, (entity, code) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return namedEntities[code] ?? entity;
  });
}

function text(value) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function unaccent(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalized(value) {
  return unaccent(text(value)).toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchKey(value) {
  return normalized(value)
    .replace(/\bdado importado\b/g, "")
    .replace(/\bbrasil\b/g, "")
    .replace(/\bcom\b/g, "com")
    .replace(/\bsem\b/g, "sem")
    .replace(/\s+/g, " ")
    .trim();
}

function aliases(name, scientificName, brand) {
  const values = new Set([normalized(name), normalized(name.split(",")[0] ?? "")]);
  if (scientificName) values.add(normalized(scientificName));
  if (brand) values.add(normalized(brand));
  values.delete("");
  values.delete(name.toLocaleLowerCase("pt-BR"));
  return [...values];
}

async function fetchText(url, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { headers: { "user-agent": "NutriFlow-TBCA-Importer/1.0 (non-commercial clinical use)" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 8) throw new Error(`Falha ao consultar ${url}: ${error instanceof Error ? error.message : String(error)}`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 400 * 2 ** attempt)));
    return fetchText(url, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

async function mapConcurrent(values, worker) {
  const result = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, run));
  return result;
}

function indexRows(html) {
  const rows = [];
  const rowPattern = /<tr><td><a href='(int_composicao_alimentos\.php\?[^']+)'>([^<]+)<\/a><\/td><td><a href='[^']+'>([\s\S]*?)<\/a><\/td><td><a href='[^']+'>([\s\S]*?)<\/a><\/td><td><a href='[^']+'>([\s\S]*?)<\/a><\/td><td><a href='[^']+'>([\s\S]*?)<\/a><\/td><\/tr>/g;
  for (const match of html.matchAll(rowPattern)) rows.push({ detailPath: decodeHtml(match[1]), code: text(match[2]), name: text(match[3]), scientificName: text(match[4]), group: text(match[5]), brand: text(match[6]) });
  return rows;
}

function parseValue(raw) {
  const value = text(raw).toLocaleLowerCase("pt-BR");
  if (!value || value === "-") return null;
  if (value === "tr") return { amountScaled: 0, source: "tbca:trace" };
  if (value === "na") return { amountScaled: 0, source: "tbca:not-analyzed-assumed-zero" };
  if (value === "nd") return null;
  const number = Number(value.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? { amountScaled: Math.round(number * 1000), source: "tbca:value" } : null;
}

function detailNutrients(html) {
  const nutrients = {};
  const rowPattern = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td>/g;
  for (const match of html.matchAll(rowPattern)) {
    const key = `${normalized(match[1])}|${normalized(match[2])}`;
    const code = nutrientRules.get(key);
    if (!code) continue;
    const value = parseValue(match[3]);
    if (value) nutrients[code] = value;
  }
  return nutrients;
}

function mirrorPayload() {
  if (!MIRROR_PATH) return null;
  const raw = fs.readFileSync(MIRROR_PATH, "utf8");
  const foods = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const item = JSON.parse(line);
    const brand = String(item.classe ?? "").trim();
    const description = String(item.descricao).trim().replace(/,+$/, "");
    const nutrients = {};
    for (const nutrient of item.nutrientes ?? []) {
      const code = nutrientRules.get(`${normalized(nutrient.Componente)}|${normalized(nutrient.Unidades)}`);
      if (!code || nutrients[code]) continue;
      const value = parseValue(nutrient["Valor por 100g"]);
      if (value) nutrients[code] = value;
    }
    const group = groupByCodeSuffix.get(String(item.codigo).slice(-1).toUpperCase());
    if (!group) throw new Error(`Grupo TBCA não identificado para ${item.codigo}`);
    return {
      detailPath: null,
      code: String(item.codigo).trim(),
      name: brand ? `${description} — ${brand}` : description,
      scientificName: "",
      group,
      brand,
      nutrients,
      scraped: true,
    };
  });
  return {
    source: {
      code: "tbca",
      version: SOURCE_VERSION,
      url: SOURCE_URL,
      accessedAt: IMPORTED_AT,
      mirrorUrl: MIRROR_URL,
      mirrorCapturedAt: MIRROR_CAPTURED_AT,
      mirrorSha256: createHash("sha256").update(raw).digest("hex"),
    },
    foods,
  };
}

async function scrape(cached = null) {
  let payload = cached;
  if (!payload || !Array.isArray(payload.foods) || payload.foods.length < 5700) {
    const pages = [];
    for (let page = 1; ; page += 10) {
      const batchPages = Array.from({ length: 10 }, (_, index) => page + index);
      const batchHtml = await mapConcurrent(batchPages, (number) => fetchText(`${BASE_URL}/composicao_alimentos.php?pagina=${number}&atuald=1`));
      const batchRows = batchHtml.flatMap(indexRows);
      pages.push(...batchRows);
      process.stderr.write(`TBCA índice: ${pages.length} alimentos\n`);
      if (batchRows.length < 1000) break;
    }
    payload = { source: { code: "tbca", version: SOURCE_VERSION, url: SOURCE_URL, accessedAt: IMPORTED_AT }, foods: [...new Map(pages.map((food) => [food.code, food])).values()] };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(payload)}\n`);
  }
  let completed = payload.foods.filter((food) => food.scraped === true).length;
  const foods = await mapConcurrent(payload.foods, async (food, index) => {
    if (food.scraped === true) return food;
    const html = await fetchText(`${BASE_URL}/${food.detailPath}`);
    const next = { ...food, nutrients: detailNutrients(html), scraped: true };
    payload.foods[index] = next;
    completed += 1;
    if (completed % 25 === 0) fs.writeFileSync(CACHE_PATH, `${JSON.stringify(payload)}\n`);
    if (completed % 100 === 0) process.stderr.write(`TBCA nutrientes: ${completed}/${payload.foods.length}\n`);
    return next;
  });
  payload = { ...payload, foods };
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(payload)}\n`);
  return payload;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function chunks(values, size = 80) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function apply(database, migrationName) {
  const migration = fs.readFileSync(`drizzle/${migrationName}`, "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

function existingCatalog() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  for (const migration of ["0020_parallel_lucky_pierre.sql", "0021_true_cerise.sql", "0023_nutriflow_base_units.sql", "0024_nutriflow_global_food_catalog.sql", "0027_nutriflow_beverages_and_flexible_unit.sql", "0029_nutriflow_taco_catalog.sql"]) apply(database, migration);
  const rows = database.prepare(`SELECT food.public_id, food.source, revision.revision_number, revision.name
    FROM nf_foods AS food INNER JOIN nf_food_revisions AS revision ON revision.food_id = food.id
    WHERE food.scope = 'global' AND revision.state = 'released'
      AND revision.revision_number = (SELECT MAX(latest.revision_number) FROM nf_food_revisions AS latest WHERE latest.food_id = food.id AND latest.state = 'released')`).all();
  const byKey = new Map();
  for (const row of rows) {
    const key = matchKey(row.name);
    const matches = byKey.get(key) ?? [];
    matches.push(row);
    byKey.set(key, matches);
  }
  return byKey;
}

function generate(payload) {
  if (payload.source?.version !== SOURCE_VERSION) throw new Error(`Versão TBCA inesperada: ${payload.source?.version}`);
  if (!Array.isArray(payload.foods) || payload.foods.length < 5700) throw new Error(`Catálogo TBCA incompleto: ${payload.foods?.length ?? 0} alimentos.`);
  const existing = existingCatalog();
  const datasetHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const claimedExistingPublicIds = new Set();
  const prepared = payload.foods.map((food) => {
    const category = categories.get(food.group);
    if (!category) throw new Error(`Grupo TBCA não mapeado: ${food.group}`);
    const matches = existing.get(matchKey(food.name)) ?? [];
    const candidate = matches.length === 1 ? matches[0] : null;
    const match = candidate && !claimedExistingPublicIds.has(candidate.public_id) ? candidate : null;
    if (match) claimedExistingPublicIds.add(match.public_id);
    const safeCode = food.code.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "_");
    const foodPublicId = match?.public_id ?? `food_tbca_${safeCode}`;
    const revisionNumber = match ? Number(match.revision_number) + 1 : 1;
    return { ...food, categoryCode: category[0], foodPublicId, revisionNumber, revisionPublicId: `foodrev_tbca_${safeCode}_v${revisionNumber}`, reconciledSource: match?.source ?? null, aliases: aliases(food.name, food.scientificName, food.brand) };
  });
  const statements = [];
  statements.push(`UPDATE nf_food_data_sources SET version = '7.3', source_url = '${SOURCE_URL}', file_sha256 = '${datasetHash}', usage_status = 'active_noncommercial_nutritional_calculation', terms_note = 'Uso não comercial para cálculo nutricional; fonte TBCA/USP/FoRC versão 7.3 preservada sem alteração dos valores; validação para eventual uso comercial em andamento.', imported_at = '${IMPORTED_AT}' WHERE code = 'tbca';`);
  statements.push(`INSERT OR IGNORE INTO nf_food_data_sources (public_id,code,version,name,source_url,file_sha256,usage_status,terms_note,imported_at) VALUES ('foodsource_tbca_7_3','tbca','7.3','Tabela Brasileira de Composição de Alimentos — TBCA','${SOURCE_URL}','${datasetHash}','active_noncommercial_nutritional_calculation','Uso não comercial para cálculo nutricional; fonte TBCA/USP/FoRC versão 7.3 preservada sem alteração dos valores; validação para eventual uso comercial em andamento.','${IMPORTED_AT}');`);
  for (const batch of chunks(prepared)) {
    const fresh = batch.filter((food) => !food.reconciledSource);
    if (fresh.length) statements.push(`WITH catalog(public_id,external_code) AS (VALUES\n${fresh.map((food) => `  (${sql(food.foodPublicId)},${sql(food.code)})`).join(",\n")}) INSERT OR IGNORE INTO nf_foods (public_id,organization_id,scope,source,external_code,status,created_by_auth_user_id) SELECT public_id,NULL,'global','tbca',external_code,'active','system:tbca-import' FROM catalog;`);
    statements.push(`WITH catalog(food_public_id,revision_public_id,revision_number,name,category_code,aliases_json,source_metadata_json) AS (VALUES\n${batch.map((food) => {
      const metadata = { sourceCode: "tbca", sourceVersion: SOURCE_VERSION, externalCode: food.code, referenceBase: "100 g de parte comestível", sourceUrl: SOURCE_URL, datasetSha256: datasetHash, importedAt: IMPORTED_AT, scientificName: food.scientificName || null, brand: food.brand || null, sourceGroup: food.group, reconciledWithExistingPublicId: food.reconciledSource ? food.foodPublicId : null, mirrorUrl: payload.source?.mirrorUrl ?? null, mirrorCapturedAt: payload.source?.mirrorCapturedAt ?? null, mirrorSha256: payload.source?.mirrorSha256 ?? null, valueSemantics: { trace: "amount_scaled=0 and source=tbca:trace", notAnalyzed: "amount_scaled=0 and source=tbca:not-analyzed-assumed-zero", unavailable: "nutrient row omitted" } };
      return `  (${sql(food.foodPublicId)},${sql(food.revisionPublicId)},${food.revisionNumber},${sql(food.name)},${sql(food.categoryCode)},${sql(JSON.stringify(food.aliases))},${sql(JSON.stringify(metadata))})`;
    }).join(",\n")}) INSERT OR IGNORE INTO nf_food_revisions (public_id,food_id,revision_number,state,name,category_code,aliases_json,reference_quantity_milli,reference_unit_id,source_metadata_json,created_by_auth_user_id,released_by_auth_user_id,released_at) SELECT catalog.revision_public_id,food.id,catalog.revision_number,'released',catalog.name,catalog.category_code,catalog.aliases_json,100000,unit.id,catalog.source_metadata_json,'system:tbca-import','system:tbca-import','${IMPORTED_AT}' FROM catalog INNER JOIN nf_foods AS food ON food.public_id=catalog.food_public_id INNER JOIN nf_units AS unit ON unit.public_id='unit_gram';`);
  }
  const nutrientRows = prepared.flatMap((food) => Object.entries(food.nutrients).map(([code, value]) => ({ revisionPublicId: food.revisionPublicId, code, ...value })));
  for (const batch of chunks(nutrientRows, 100)) statements.push(`WITH values_to_import(revision_public_id,nutrient_code,amount_scaled,source) AS (VALUES\n${batch.map((value) => `  (${sql(value.revisionPublicId)},${sql(value.code)},${value.amountScaled},${sql(value.source)})`).join(",\n")}) INSERT OR IGNORE INTO nf_food_nutrients (food_revision_id,nutrient_id,amount_scaled,source) SELECT revision.id,nutrient.id,values_to_import.amount_scaled,values_to_import.source FROM values_to_import INNER JOIN nf_food_revisions AS revision ON revision.public_id=values_to_import.revision_public_id INNER JOIN nf_nutrients AS nutrient ON nutrient.code=values_to_import.nutrient_code;`);
  statements.push(`UPDATE nf_feature_flag_overrides SET enabled=1,variant='production-stable',reason='Cálculo nutricional TBCA/TACO',expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE organization_id=(SELECT id FROM nf_organizations WHERE public_id='org_ludgero_sangaletti' AND status='active' LIMIT 1) AND client_id IS NULL AND flag_key='nutriflow.nutrition_totals.enabled';`);
  statements.push(`INSERT INTO nf_feature_flag_overrides (public_id,flag_key,organization_id,client_id,enabled,variant,reason,expires_at,created_by_auth_user_id,created_at,updated_at) SELECT 'flag_prod_'||lower(hex(randomblob(12))),'nutriflow.nutrition_totals.enabled',organization.id,NULL,1,'production-stable','Cálculo nutricional TBCA/TACO',NULL,'system:tbca-import',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM nf_organizations AS organization WHERE organization.public_id='org_ludgero_sangaletti' AND organization.status='active' AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key='nutriflow.nutrition_totals.enabled' AND existing.organization_id=organization.id AND existing.client_id IS NULL);`);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${statements.join("\n--> statement-breakpoint\n")}\n`);
  return { foods: prepared.length, reconciled: prepared.filter((food) => food.reconciledSource).length, newFoods: prepared.filter((food) => !food.reconciledSource).length, nutrientValues: nutrientRows.length, completeMacroFoods: prepared.filter((food) => ["energy_kcal", "protein", "carbohydrate", "lipids"].every((code) => food.nutrients[code])).length, datasetHash, outputPath: OUTPUT_PATH };
}

const mirrored = mirrorPayload();
const cached = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) : null;
const payload = mirrored ?? (cached?.foods?.every((food) => food.scraped === true) ? cached : await scrape(cached));
console.log(JSON.stringify(generate(payload)));
