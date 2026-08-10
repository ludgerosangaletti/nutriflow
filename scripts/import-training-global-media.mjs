import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const chunkSize = 700 * 1024;
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const allowNewVersion = argv.includes("--allow-new-version");
const manifestPaths = argv.filter((value) => !value.startsWith("--"));
const baseUrl = String(process.env.TRAINING_MEDIA_IMPORT_URL || "").replace(/\/$/, "");
const secret = String(process.env.TRAINING_MEDIA_IMPORT_SECRET || "");

if (!manifestPaths.length) throw new Error("usage: npm run training:media:import -- manifest.json [manifest-2.json]");
if (!dryRun && (!baseUrl || !secret)) throw new Error("TRAINING_MEDIA_IMPORT_URL and TRAINING_MEDIA_IMPORT_SECRET are required");

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function chunks(bytes) {
  return Array.from({ length: Math.ceil(bytes.length / chunkSize) }, (_, index) => bytes.subarray(index * chunkSize, Math.min(bytes.length, (index + 1) * chunkSize)));
}

async function request(path, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...(init.headers || {}), "x-training-media-import-secret": secret } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`${response.status}:${body.error || "request-failed"}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((done) => setTimeout(done, 500 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

async function uploadParts(uploadId, kind, bytes) {
  const parts = chunks(bytes);
  for (let index = 0; index < parts.length; index += 1) {
    await request(`/api/internal/nutriflow/training/media/import?uploadId=${uploadId}&kind=${kind}&partNumber=${index + 1}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream", "content-length": String(parts[index].length) },
      body: parts[index],
    });
  }
  return parts.length;
}

async function importItem(directory, item) {
  const [video, poster] = await Promise.all([
    readFile(resolve(directory, item.videoFile)),
    readFile(resolve(directory, item.posterFile)),
  ]);
  const contentSha256 = sha256(video);
  const posterSha256 = sha256(poster);
  if (dryRun) return { exercisePublicId: item.exercisePublicId, status: "validated", contentSha256, posterSha256 };
  const uploadId = randomUUID();
  let videoParts = 0;
  let posterParts = 0;
  try {
    videoParts = await uploadParts(uploadId, "video", video);
    posterParts = await uploadParts(uploadId, "poster", poster);
    return await request("/api/internal/nutriflow/training/media/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploadId,
        videoParts,
        posterParts,
        videoSize: video.length,
        posterSize: poster.length,
        contentSha256,
        posterSha256,
        allowNewVersion,
        item,
      }),
    }, 1);
  } catch (error) {
    if (videoParts && posterParts) {
      await request(`/api/internal/nutriflow/training/media/import?uploadId=${uploadId}&videoParts=${videoParts}&posterParts=${posterParts}`, { method: "DELETE" }, 1).catch(() => undefined);
    }
    return { exercisePublicId: item.exercisePublicId, status: "failed", error: error instanceof Error ? error.message : "import-failed" };
  }
}

const results = [];
for (const manifestPath of manifestPaths) {
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifest, "utf8"));
  if (manifest.apiVersion !== 1 || !Array.isArray(manifest.items)) throw new Error(`invalid manifest: ${manifestPath}`);
  for (const item of manifest.items) results.push(await importItem(dirname(absoluteManifest), item));
}

const summary = Object.fromEntries(["created", "already_present", "updated_version", "skipped", "failed", "validated"].map((status) => [status, results.filter((item) => item.status === status).length]));
const verification = dryRun ? null : await request("/api/internal/nutriflow/training/media/import", { method: "GET" }, 1);
process.stdout.write(`${JSON.stringify({ manifests: manifestPaths.length, items: results.length, summary, verification, results }, null, 2)}\n`);
if (summary.failed) process.exitCode = 1;
