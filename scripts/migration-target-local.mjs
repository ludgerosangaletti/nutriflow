const json = (body, status = 200) => Response.json(body, { status });
const decode = (value) => value && typeof value === "object" && value.$type === "base64"
  ? Uint8Array.from(atob(value.value), (c) => c.charCodeAt(0))
  : value && typeof value === "object" && value.$type === "bigint" ? value.value : value;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/d1/execute") {
      const { batch } = await request.json();
      if (!Array.isArray(batch) || batch.length < 1 || batch.length > 100) return json({ error: "invalid-batch" }, 400);
      try {
        const result = await env.DB.batch(batch.map(({ sql, params = [] }) => env.DB.prepare(sql).bind(...params.map(decode))));
        return json({ ok: true, result: result.map((entry) => entry.meta) });
      } catch (error) { return json({ error: String(error) }, 409); }
    }
    if (request.method === "POST" && url.pathname === "/d1/verify") {
      const { tables } = await request.json();
      const schema = await env.DB.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE substr(name,1,1)<>'_' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type,name").all();
      const counts = {};
      for (let offset = 0; offset < tables.length; offset += 20) {
        const names = tables.slice(offset, offset + 20);
        const rows = await env.DB.batch(names.map((name) => env.DB.prepare('SELECT COUNT(*) AS count FROM "' + name.replaceAll('"', '""') + '"')));
        names.forEach((name, index) => { counts[name] = Number(rows[index].results[0].count); });
      }
      const quick = await env.DB.prepare("PRAGMA quick_check").all();
      const foreign = await env.DB.prepare("PRAGMA foreign_key_check").all();
      return json({ schema: schema.results, counts, quick: quick.results, foreign: foreign.results });
    }
    if (request.method === "PUT" && url.pathname === "/r2/object") {
      const key = url.searchParams.get("key");
      if (!key || await env.BUCKET.head(key)) return json({ error: "invalid-or-existing-key" }, 409);
      const metadata = (name) => JSON.parse(Buffer.from(request.headers.get(name) || "e30=", "base64").toString("utf8"));
      const object = await env.BUCKET.put(key, request.body, {
        httpMetadata: metadata("x-nutriflow-http-metadata"),
        customMetadata: metadata("x-nutriflow-custom-metadata"),
      });
      return json({ ok: true, etag: object.etag });
    }
    if (request.method === "GET" && url.pathname === "/r2/verify") {
      const objects = []; let cursor;
      do {
        const page = await env.BUCKET.list({ cursor, limit: 500, include: ["httpMetadata", "customMetadata"] });
        objects.push(...page.objects.map((o) => ({ key: o.key, size: o.size, etag: o.etag, httpMetadata: o.httpMetadata || {}, customMetadata: o.customMetadata || {} })));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return json({ objects });
    }
    return json({ error: "not-found" }, 404);
  },
};

