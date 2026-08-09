#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS,
  assertCuratedTrainingMediaBytes,
  assertTrainingMediaUpload,
  parseGlobalTrainingMediaImportManifest,
} from "../modules/nutriflow/domain/training/training-media.ts";

const execFileAsync = promisify(execFile);
const posterMimeTypes = Object.freeze({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" });

function reason(error) {
  return error instanceof Error ? error.message.replace(/^NUTRIFLOW_TRAINING_MEDIA_INVALID:/, "") : String(error);
}

async function defaultProbe(filename) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name:format=duration",
    "-of", "json", filename,
  ], { windowsHide: true });
  const value = JSON.parse(stdout);
  return { codec: value.streams?.[0]?.codec_name ?? null, durationSeconds: Number(value.format?.duration) };
}

export async function catalogSlugsFromMigration(projectRoot) {
  const sql = await readFile(join(projectRoot, "drizzle", "0040_nutriflow_training_foundation.sql"), "utf8");
  return new Set([...sql.matchAll(/tr_ex_global_([a-z0-9_]+)/g)].map((match) => match[1]));
}

export async function validateTrainingMediaBatch({ batchDir, manifestPath = join(batchDir, "manifest.json"), catalogSlugs, probe = defaultProbe }) {
  const manifestBytes = await readFile(manifestPath);
  const batchErrors = [];
  if (manifestBytes.byteLength > GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.manifestBytes) batchErrors.push("manifest-size");
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")); } catch { manifest = null; batchErrors.push("manifest-json"); }
  const rawItems = Array.isArray(manifest?.items) ? manifest.items : [];
  if (manifest?.apiVersion !== 1) batchErrors.push("manifest-api-version");
  if (rawItems.length === 0) batchErrors.push("manifest-empty");
  const slugCounts = new Map();
  const fileCounts = new Map();
  for (const item of rawItems) {
    if (typeof item?.slug === "string") slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
    for (const name of [item?.videoFile, item?.posterFile]) if (typeof name === "string") fileCounts.set(name, (fileCounts.get(name) ?? 0) + 1);
  }
  const filesOnDisk = new Set(await readdir(batchDir));
  const results = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const raw = rawItems[index];
    const errors = [];
    let item = null;
    try { item = parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [raw] }).items[0]; } catch (error) { errors.push(reason(error)); }
    const slug = typeof raw?.slug === "string" ? raw.slug : null;
    const videoFile = typeof raw?.videoFile === "string" ? raw.videoFile : null;
    const posterFile = typeof raw?.posterFile === "string" ? raw.posterFile : null;
    const recognized = Boolean(slug && catalogSlugs.has(slug));
    if (slug && (slugCounts.get(slug) ?? 0) > 1) errors.push("slug-duplicate");
    if (slug && !recognized) errors.push("slug-not-found");
    for (const name of [videoFile, posterFile]) if (name && (fileCounts.get(name) ?? 0) > 1) errors.push(`file-duplicate:${name}`);
    if (item && videoFile && posterFile) {
      const videoPath = join(batchDir, videoFile);
      const posterPath = join(batchDir, posterFile);
      if (!filesOnDisk.has(videoFile)) errors.push("video-missing");
      if (!filesOnDisk.has(posterFile)) errors.push("poster-missing");
      if (filesOnDisk.has(videoFile) && filesOnDisk.has(posterFile)) {
        const [videoStat, posterStat, videoBytes, posterBytes] = await Promise.all([stat(videoPath), stat(posterPath), readFile(videoPath), readFile(posterPath)]);
        const posterType = posterMimeTypes[extname(posterFile).toLowerCase()] ?? "application/octet-stream";
        try {
          assertTrainingMediaUpload({ kind: "video", mediaName: videoFile, mediaType: "video/mp4", mediaBytes: videoStat.size, posterName: posterFile, posterType, posterBytes: posterStat.size, durationMs: item.durationMs });
          assertCuratedTrainingMediaBytes(videoBytes, posterBytes, posterType);
        } catch (error) { errors.push(reason(error)); }
        try {
          const media = await probe(videoPath);
          if (media.codec !== "h264") errors.push(`video-codec:${media.codec ?? "unknown"}`);
          if (!Number.isFinite(media.durationSeconds) || media.durationSeconds < 1 || media.durationSeconds > 90) errors.push("video-duration-probe");
          else if (Math.abs(media.durationSeconds * 1000 - item.durationMs) > 750) errors.push("video-duration-manifest-mismatch");
        } catch (error) { errors.push(`video-probe:${reason(error)}`); }
      }
    }
    results.push(Object.freeze({ index, slug, recognized, videoFile, posterFile, approved: errors.length === 0, reasons: Object.freeze([...new Set(errors)]) }));
  }
  const expectedFiles = new Set(rawItems.flatMap((item) => [item?.videoFile, item?.posterFile]).filter((value) => typeof value === "string"));
  const ignored = new Set([basename(manifestPath)]);
  const unexpectedFiles = [...filesOnDisk].filter((name) => !expectedFiles.has(name) && !ignored.has(name)).sort();
  if (unexpectedFiles.length) batchErrors.push(`unexpected-files:${unexpectedFiles.join(",")}`);
  const approved = results.filter((item) => item.approved).length;
  const approvedItems = results.filter((item) => item.approved);
  const importPlan = [];
  for (let offset = 0; offset < approvedItems.length; offset += GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items) {
    importPlan.push(Object.freeze({
      batchNumber: importPlan.length + 1,
      items: Object.freeze(approvedItems.slice(offset, offset + GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items).map((item) => Object.freeze({ index: item.index, slug: item.slug, videoFile: item.videoFile, posterFile: item.posterFile }))),
    }));
  }
  return Object.freeze({
    manifestPath: resolve(manifestPath),
    summary: Object.freeze({ received: results.length, recognized: results.filter((item) => item.recognized).length, approved, rejected: results.length - approved, maxItemsPerImport: GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items, recommendedImportBatches: Math.ceil(approved / GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items), requiresBatchSplit: approved > GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items }),
    batchErrors: Object.freeze(batchErrors),
    items: Object.freeze(results),
    importPlan: Object.freeze(importPlan),
    aptForImport: batchErrors.length === 0 && results.length > 0 && results.every((item) => item.approved) && results.length <= GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items,
  });
}

async function main() {
  const batchDir = resolve(process.argv[2] ?? ".");
  const manifestPath = resolve(process.argv[3] ?? join(batchDir, "manifest.json"));
  const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
  const report = await validateTrainingMediaBatch({ batchDir, manifestPath, catalogSlugs: await catalogSlugsFromMigration(projectRoot) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.aptForImport ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { process.stderr.write(`${reason(error)}\n`); process.exitCode = 2; });
