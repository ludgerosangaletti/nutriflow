const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

async function authorized(request: Request) {
  const candidate = request.headers.get("x-checkin-reminder-secret");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!candidate || !supabaseUrl || !serviceRoleKey) return false;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_nutriflow_internal_secret`, {
    method: "POST", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" }, body: JSON.stringify({ candidate }),
  });
  return response.ok && (await response.json().catch(() => false)) === true;
}

type Kind = "diet" | "training" | "clinical_anamnesis" | "training_anamnesis";
const content: Record<Kind, { subject: string; title: string; message: string; href: string; button: string; admin: boolean }> = {
  diet: { subject: "Seu plano alimentar está disponível", title: "Plano alimentar disponível", message: "Seu novo plano alimentar foi publicado e já pode ser consultado no NutriFlow.", href: "/plano-alimentar", button: "Acessar meu plano", admin: false },
  training: { subject: "Seu treino está disponível", title: "Treino disponível", message: "Seu treino foi publicado e já pode ser consultado no NutriFlow.", href: "/treino", button: "Acessar meu treino", admin: false },
  clinical_anamnesis: { subject: "Anamnese clínica concluída", title: "Anamnese clínica recebida", message: "concluiu a anamnese clínica da consultoria on-line. O protocolo já pode ser preparado.", href: "/admin/clientes", button: "Abrir pacientes", admin: true },
  training_anamnesis: { subject: "Anamnese de treino concluída", title: "Anamnese de treino recebida", message: "concluiu a anamnese de treino. O treino já pode ser preparado.", href: "/admin/clientes", button: "Abrir pacientes", admin: true },
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!(await authorized(request))) return json({ error: "Não autorizado." }, 401);
  const body = await request.json().catch(() => null) as { kind?: Kind; eventId?: string; patientName?: string; patientEmail?: string; modality?: string; referenceId?: string } | null;
  if (!body?.kind || !content[body.kind] || !body.eventId || !body.patientName || !body.patientEmail || !body.referenceId) return json({ error: "Dados inválidos." }, 400);
  const definition = content[body.kind];
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!resendKey || !from || (definition.admin && !adminEmail)) return json({ error: "Canal de e-mail indisponível." }, 503);
  const firstName = escapeHtml(body.patientName.trim().split(/\s+/)[0] || "Paciente");
  const fullName = escapeHtml(body.patientName.trim());
  const recipient = definition.admin ? adminEmail! : body.patientEmail;
  const message = definition.admin ? `<strong>${fullName}</strong> (${escapeHtml(body.patientEmail)}) ${definition.message}` : `Olá, ${firstName}. ${definition.message}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json", "idempotency-key": `nutriflow-${body.kind}-${body.referenceId}` },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${from}>`, to: [recipient], subject: definition.admin ? `${definition.subject}: ${body.patientName}` : definition.subject,
      html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">NUTRIFLOW</div><div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div></td></tr><tr><td style="padding:34px"><h1 style="font-size:25px;margin:0 0 18px">${definition.title}</h1><p style="font-size:16px;line-height:1.6">${message}</p><a href="https://ludgerosangaletti.com.br${definition.href}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:10px">${definition.button}</a><p style="font-size:13px;line-height:1.5;color:#666;margin:28px 0 0">Mensagem automática do NutriFlow.</p></td></tr></table></td></tr></table></body></html>`,
    }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) return json({ error: result.message || "Falha no envio." }, 502);
  return json({ ok: true, id: result.id, kind: body.kind });
});
