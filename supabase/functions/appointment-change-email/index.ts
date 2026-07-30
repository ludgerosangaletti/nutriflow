const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = Deno.env.get("CHECKIN_REMINDER_SECRET") || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    whatsapp?: string;
    appointmentAt?: string;
    requestedAppointmentAt?: string | null;
    action?: string;
    location?: string;
  } | null;

  if (
    !body?.email ||
    !body.email.includes("@") ||
    !body.appointmentAt ||
    Number.isNaN(new Date(body.appointmentAt).getTime()) ||
    !body.action
  ) {
    return json({ error: "Dados da solicitação inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!apiKey || !fromEmail || !adminEmail) {
    return json({ error: "Configuração de e-mail incompleta." }, 500);
  }

  const rawName =
    body.name?.trim() || body.email.split("@")[0]?.trim() || "Paciente";
  const name = escapeHtml(rawName);
  const action = escapeHtml(body.action);
  const whatsapp = escapeHtml(body.whatsapp || "Não informado");
  const currentAppointment = formatDate(body.appointmentAt);
  const requestedAppointment = body.requestedAppointmentAt
    ? formatDate(body.requestedAppointmentAt)
    : null;
  const isReschedule =
    body.action.toLowerCase().includes("remarcação") &&
    Boolean(requestedAppointment);
  const title = isReschedule
    ? "Solicitação de remarcação"
    : body.action.toLowerCase().includes("cancelamento")
      ? "Solicitação de cancelamento"
      : "Resposta recebida pelo chatbot";
  const subject = `${body.action} — ${rawName}`;
  const patientDigits = (body.whatsapp || "").replace(/\D/g, "");
  const patientPhone =
    patientDigits.length >= 12 || patientDigits.startsWith("55")
      ? patientDigits
      : patientDigits
        ? `55${patientDigits}`
        : "";

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">AGENDA PRESENCIAL</div><div style="font-size:24px;font-weight:800;margin-top:8px">${title}</div></td></tr>
<tr><td style="padding:34px"><p style="font-size:16px;line-height:1.6;margin-top:0">${isReschedule ? "O paciente escolheu um novo horário pelo chatbot. A alteração ainda depende da sua aprovação." : `${action}. A solicitação aguarda sua análise.`}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;border-radius:12px;padding:18px">
<tr><td style="padding:7px"><strong>Paciente</strong></td><td style="padding:7px">${name}</td></tr>
<tr><td style="padding:7px"><strong>WhatsApp</strong></td><td style="padding:7px">${whatsapp}</td></tr>
<tr><td style="padding:7px"><strong>Horário atual</strong></td><td style="padding:7px">${escapeHtml(currentAppointment)}</td></tr>
${requestedAppointment ? `<tr><td style="padding:7px"><strong>Novo horário solicitado</strong></td><td style="padding:7px;font-weight:800">${escapeHtml(requestedAppointment)}</td></tr>` : ""}
<tr><td style="padding:7px"><strong>Situação</strong></td><td style="padding:7px">Aguardando sua decisão</td></tr>
</table>
<a href="https://ludgerosangaletti.com.br/admin/clientes/${encodeURIComponent(body.email)}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:20px">Analisar solicitação</a>
${patientPhone ? `<a href="https://wa.me/${patientPhone}" style="display:inline-block;background:#f1f0ea;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin:10px 0 0 8px">Falar com o paciente</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [adminEmail],
      subject,
      html,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    return json({ error: result.message || "Falha no envio." }, 502);
  }
  return json({ ok: true, emailId: result.id || null, template: "appointment-change-v1" });
});
