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

async function sendEmail(
  apiKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [to],
      subject,
      html,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(result.message || "Falha no envio.");
  return result.id || null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = Deno.env.get("CHECKIN_REMINDER_SECRET") || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const body = (await request.json().catch(() => null)) as {
    kind?: "reminder" | "pending_admin" | "patient_action";
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
    !body.name ||
    !body.appointmentAt ||
    Number.isNaN(new Date(body.appointmentAt).getTime())
  ) {
    return json({ error: "Dados do retorno inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!apiKey || !fromEmail || !adminEmail) {
    return json({ error: "Configuração de e-mail incompleta." }, 500);
  }

  const name = escapeHtml(body.name.trim());
  const firstName = escapeHtml(body.name.trim().split(/\s+/)[0] || "paciente");
  const email = escapeHtml(body.email);
  const whatsapp = escapeHtml(body.whatsapp || "Não informado");
  const location = escapeHtml(body.location || "Guarapuava — PR");
  const appointment = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(body.appointmentAt));
  const chatbotPhone = "5542999889176";
  const patientDigits = (body.whatsapp || "").replace(/\D/g, "");
  const patientPhone =
    patientDigits.length >= 12 || patientDigits.startsWith("55")
      ? patientDigits
      : patientDigits
        ? `55${patientDigits}`
        : "";
  const confirmText = encodeURIComponent("CONFIRMAR RETORNO");
  const rescheduleText = encodeURIComponent("REMARCAR RETORNO");
  const cancelText = encodeURIComponent("CANCELAR RETORNO");

  if (body.kind === "pending_admin" || body.kind === "patient_action") {
    const action =
      body.kind === "pending_admin"
        ? "O paciente ainda não confirmou o retorno e a consulta está a 48 horas ou menos."
        : escapeHtml(body.action || "O paciente respondeu ao chatbot.");
    const requested = body.requestedAppointmentAt
      ? formatDate(body.requestedAppointmentAt)
      : null;
    const adminOnlyHtml = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">AGENDA PRESENCIAL</div><div style="font-size:24px;font-weight:800;margin-top:8px">${body.kind === "pending_admin" ? "Confirmação pendente" : "Resposta recebida pelo chatbot"}</div></td></tr>
<tr><td style="padding:34px"><p style="font-size:16px;line-height:1.6">${action}</p>
<p><strong>Paciente:</strong> ${name}<br><strong>Retorno atual:</strong> ${escapeHtml(appointment)}${requested ? `<br><strong>Novo horário solicitado:</strong> ${escapeHtml(requested)}` : ""}</p>
<a href="https://ludgerosangaletti.com.br/admin/clientes/${encodeURIComponent(body.email)}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:10px">Abrir prontuário</a>
${patientPhone ? `<a href="https://wa.me/${patientPhone}" style="display:inline-block;background:#f1f0ea;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin:10px 0 0 8px">Falar com o paciente</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;
    try {
      const adminId = await sendEmail(
        apiKey,
        fromEmail,
        adminEmail,
        body.kind === "pending_admin"
          ? `Confirmação pendente — ${body.name}`
          : `${body.action || "Resposta do paciente"} — ${body.name}`,
        adminOnlyHtml,
      );
      return json({ ok: true, adminId });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Falha no envio." },
        502,
      );
    }
  }

  const patientHtml = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">LEMBRETE DE RETORNO</div><div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div></td></tr>
<tr><td style="padding:34px"><h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">Vamos confirmar sua próxima consulta?</h1>
<p style="font-size:16px;line-height:1.6">Olá, ${firstName}!</p>
<p style="font-size:16px;line-height:1.6">Seu retorno está previsto para <strong>${escapeHtml(appointment)}</strong>, em <strong>${location}</strong>.</p>
<p style="font-size:16px;line-height:1.6;margin-bottom:24px">Escolha uma opção. O chatbot registrará sua resposta e avisará o Ludgero:</p>
<a href="https://wa.me/${chatbotPhone}?text=${confirmText}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 20px;border-radius:10px;margin:0 8px 10px 0">Confirmar retorno</a>
<a href="https://wa.me/${chatbotPhone}?text=${rescheduleText}" style="display:inline-block;background:#f1f0ea;color:#111;text-decoration:none;font-weight:800;padding:15px 20px;border-radius:10px;margin:0 8px 10px 0">Solicitar outro horário</a>
<a href="https://wa.me/${chatbotPhone}?text=${cancelText}" style="display:inline-block;background:#f1f0ea;color:#a11;text-decoration:none;font-weight:800;padding:15px 20px;border-radius:10px;margin-bottom:10px">Cancelar retorno</a>
<p style="font-size:13px;line-height:1.5;color:#777;margin:24px 0 0">Pedidos de remarcação e cancelamento dependem da aprovação do Ludgero.</p>
</td></tr></table></td></tr></table></body></html>`;

  const adminHtml = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">ALERTA DE AGENDA</div><div style="font-size:24px;font-weight:800;margin-top:8px">Lembrete de retorno enviado</div></td></tr>
<tr><td style="padding:34px"><p style="font-size:16px;line-height:1.6;margin-top:0">O paciente recebeu o lembrete e foi orientado a responder pelo chatbot. Você receberá um novo aviso quando ele confirmar, cancelar ou solicitar remarcação.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;border-radius:12px;padding:18px">
<tr><td style="padding:7px"><strong>Paciente</strong></td><td style="padding:7px">${name}</td></tr>
<tr><td style="padding:7px"><strong>E-mail</strong></td><td style="padding:7px">${email}</td></tr>
<tr><td style="padding:7px"><strong>WhatsApp</strong></td><td style="padding:7px">${whatsapp}</td></tr>
<tr><td style="padding:7px"><strong>Retorno</strong></td><td style="padding:7px">${escapeHtml(appointment)}</td></tr>
<tr><td style="padding:7px"><strong>Local</strong></td><td style="padding:7px">${location}</td></tr>
</table>
${patientPhone ? `<a href="https://wa.me/${patientPhone}?text=${encodeURIComponent(`Olá, ${body.name}! Estou entrando em contato para confirmar seu retorno previsto em ${appointment}.`)}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:22px">Conversar com o paciente</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;

  try {
    const patientId = await sendEmail(
      apiKey,
      fromEmail,
      body.email,
      "Confirme seu próximo retorno com Ludgero Sangaletti",
      patientHtml,
    );
    const adminId = await sendEmail(
      apiKey,
      fromEmail,
      adminEmail,
      `Retorno a confirmar — ${body.name}`,
      adminHtml,
    );
    return json({ ok: true, patientId, adminId });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Falha no envio." },
      502,
    );
  }
});
