import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  adjustmentRequests,
  clients,
  patientDocuments,
  progressPhotos,
} from "../../../../../db/schema";
import { getAdminSession } from "../../../../supabase/server";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    confirmation?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const confirmation = String(body.confirmation || "").trim().toLowerCase();
  if (!validEmail(email) || confirmation !== email) {
    return Response.json(
      { error: "A confirmação deve ser igual ao e-mail do paciente." },
      { status: 400 },
    );
  }
  if (email === admin.user.email?.toLowerCase()) {
    return Response.json(
      { error: "A conta administrativa não pode ser excluída por esta área." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client) {
    return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const authResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reset-patient-account`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${admin.session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, userId: client.authUserId }),
    },
  );
  const authResult = (await authResponse.json().catch(() => ({}))) as {
    deleted?: boolean;
    error?: string;
  };
  const accountWasAlreadyRemoved =
    !authResponse.ok &&
    /not found|does not exist|n.o encontrado|inexistente/i.test(
      authResult.error || "",
    );
  if (
    (!authResponse.ok || authResult.deleted !== true) &&
    !accountWasAlreadyRemoved
  ) {
    return Response.json(
      {
        error:
          authResult.error ||
          "A conta de acesso não pôde ser removida. Nenhum dado clínico foi excluído.",
      },
      { status: 502 },
    );
  }

  const [documents, photos, adjustments] = await Promise.all([
    db
      .select({ objectKey: patientDocuments.objectKey })
      .from(patientDocuments)
      .where(eq(patientDocuments.clientEmail, email)),
    db
      .select({ objectKey: progressPhotos.objectKey })
      .from(progressPhotos)
      .where(eq(progressPhotos.clientEmail, email)),
    db
      .select({ attachmentKey: adjustmentRequests.attachmentKey })
      .from(adjustmentRequests)
      .where(eq(adjustmentRequests.clientEmail, email)),
  ]);
  const objectKeys = [
    ...documents.map((item) => item.objectKey),
    ...photos.map((item) => item.objectKey),
    ...adjustments.flatMap((item) =>
      item.attachmentKey ? [item.attachmentKey] : [],
    ),
  ];
  if (objectKeys.length) {
    await env.BUCKET.delete(objectKeys);
  }

  const now = new Date().toISOString();
  const tombstoneEmail = `reset-${client.id}-${Date.now()}@deleted.invalid`;
  const plan = await env.DB.prepare(
    "SELECT id FROM nf_plans WHERE client_id = ? LIMIT 1",
  ).bind(client.id).first<{ id: number }>();

  const cleanup = [
    env.DB.prepare(
      "DELETE FROM appointment_change_requests WHERE client_email = ?",
    ).bind(email),
    env.DB.prepare(
      "DELETE FROM appointment_reminders WHERE client_email = ?",
    ).bind(email),
    env.DB.prepare("DELETE FROM goal_progress WHERE client_email = ?").bind(email),
    env.DB.prepare("DELETE FROM goals WHERE client_email = ?").bind(email),
    env.DB.prepare("DELETE FROM adjustment_requests WHERE client_email = ?").bind(
      email,
    ),
    env.DB.prepare("DELETE FROM renewal_reminders WHERE client_email = ?").bind(
      email,
    ),
    env.DB.prepare("DELETE FROM check_in_reminders WHERE client_email = ?").bind(
      email,
    ),
    env.DB.prepare("DELETE FROM check_ins WHERE client_email = ?").bind(email),
    env.DB.prepare("DELETE FROM patient_documents WHERE client_email = ?").bind(
      email,
    ),
    env.DB.prepare("DELETE FROM progress_photos WHERE client_email = ?").bind(
      email,
    ),
    env.DB.prepare("DELETE FROM anamneses WHERE client_email = ?").bind(email),
  ];

  if (plan) {
    cleanup.push(
      env.DB.prepare(`UPDATE clients SET
        auth_user_id = NULL,
        email = ?,
        name = 'Cadastro reiniciado',
        whatsapp = '',
        birth_date = NULL,
        profile_completed_at = NULL,
        invite_status = 'not_applicable',
        invite_sent_at = NULL,
        invite_accepted_at = NULL,
        invite_error = NULL,
        payment_status = 'reset',
        access_started_at = NULL,
        access_expires_at = NULL,
        next_appointment_at = NULL,
        appointment_status = 'cancelled',
        appointment_confirmation_status = 'not_applicable',
        appointment_confirmation_token = NULL,
        appointment_confirmation_expires_at = NULL,
        appointment_confirmation_sent_at = NULL,
        appointment_confirmation_responded_at = NULL,
        google_calendar_event_id = NULL,
        google_calendar_synced_at = NULL,
        form_status = 'not_started',
        archived_at = ?,
        archive_reason = 'patient_requested_restart',
        updated_at = ?
        WHERE id = ? AND email = ?`)
        .bind(tombstoneEmail, now, now, client.id, email),
    );
  } else {
    cleanup.push(
      env.DB.prepare("DELETE FROM nf_feature_flag_overrides WHERE client_id = ?").bind(client.id),
      env.DB.prepare("DELETE FROM nf_delivery_settings WHERE client_id = ?").bind(client.id),
      env.DB.prepare("DELETE FROM clients WHERE id = ? AND email = ?").bind(client.id, email),
    );
  }

  try {
    await env.DB.batch(cleanup);
  } catch (error) {
    console.error("[patient-reset.cleanup]", JSON.stringify({ clientId: client.id, preservedNutriFlowHistory: Boolean(plan), error: error instanceof Error ? error.message : "unknown" }));
    return Response.json(
      {
        error: "A conta de acesso já foi removida, mas o prontuário ainda não terminou de ser reiniciado. Clique novamente em ‘Excluir e reiniciar paciente’ para concluir com segurança.",
        retryable: true,
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, deleted: true, clinicalHistoryPreserved: Boolean(plan) });
}
