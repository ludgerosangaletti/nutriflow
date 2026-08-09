import { env } from "cloudflare:workers";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../modules/nutriflow/config/feature-flags.ts";
import { publicationReferencesTrainingMedia } from "../../../../modules/nutriflow/domain/training/training-media.ts";
import { canUseNutriFlowFeature, createNutriFlowPatientRuntime, createTrainingMediaRepository, resolveNutriFlowPatientContext } from "../../../nutriflow/server.ts";
import { getPatientUser } from "../../../supabase/server.ts";

function queryText(value: string | null) { return value && /^[a-zA-Z0-9_-]{3,200}$/.test(value) ? value : null; }

export async function GET(request: Request) {
  const user = await getPatientUser();
  const query = new URL(request.url).searchParams;
  const publicationPublicId = queryText(query.get("publication"));
  const mediaPublicId = queryText(query.get("media"));
  const variant = query.get("variant");
  if (!user || !publicationPublicId || !mediaPublicId || (variant !== "poster" && variant !== "video")) return new Response("Arquivo não encontrado.", { status: 404 });
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowFeature(context, context.actor.clientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) return new Response("Arquivo não encontrado.", { status: 404 });
  try {
    const portal = await createNutriFlowPatientRuntime().getTraining.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId });
    if (!portal.publication || portal.publication.publicId !== publicationPublicId || !publicationReferencesTrainingMedia(portal.publication.content, mediaPublicId)) return new Response("Arquivo não encontrado.", { status: 404 });
    const media = await createTrainingMediaRepository().findAssetForOrganization(mediaPublicId, context.organizationId);
    const objectKey = variant === "poster" ? media?.posterObjectKey : media?.objectKey;
    const type = variant === "poster" ? media?.posterMimeType : media?.mimeType;
    if (!media || !objectKey || !type) return new Response("Arquivo não encontrado.", { status: 404 });
    const object = request.headers.has("range") && variant === "video"
      ? await env.BUCKET.get(objectKey, { range: request.headers })
      : await env.BUCKET.get(objectKey);
    if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
    const headers = new Headers({ "cache-control": "private, max-age=3600", "content-type": type, "x-content-type-options": "nosniff", "accept-ranges": "bytes" });
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (object.range) {
      headers.set("content-range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      headers.set("content-length", String(object.range.length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  } catch { return new Response("Arquivo não encontrado.", { status: 404 }); }
}
