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
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = Deno.env.get("CHECKIN_REMINDER_SECRET") || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    plan?: string;
    daysRemaining?: number;
    expiresAt?: string;
  } | null;
  if (
    !body?.email ||
    !body.email.includes("@") ||
    !body.name ||
    !body.plan ||
    !body.expiresAt ||
    ![7, 3, 1].includes(Number(body.daysRemaining)) ||
    Number.isNaN(new Date(body.expiresAt).getTime())
  ) {
    return json({ error: "Dados do paciente inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return json({ error: "E-mail não configurado." }, 500);

  const firstName = escapeHtml(body.name.trim().split(/\s+/)[0] || "paciente");
  const plan = escapeHtml(body.plan);
  const days = Number(body.daysRemaining);
  const expiryDate = escapeHtml(formatDate(body.expiresAt));
  const subject =
    days === 1
      ? "Seu acompanhamento termina amanhã"
      : `Faltam ${days} dias para o fim do seu acompanhamento`;
  const headline =
    days === 1
      ? "Seu plano termina amanhã"
      : `Seu plano termina em ${days} dias`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [body.email],
      subject,
      html: `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff">
<div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">CONTINUIDADE DO ACOMPANHAMENTO</div>
<div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div>
</td></tr>
<tr><td style="padding:34px">
<h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">${headline}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Olá, ${firstName}!</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">A vigência do seu plano <strong>${plan}</strong> vai até <strong>${expiryDate}</strong>.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Se desejar continuar com a assessoria, os check-ins, ajustes e acesso aos seus materiais sem interrupção, você já pode escolher a renovação pelo site.</p>
<a href="https://ludgerosangaletti.com.br/#comprar" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px">Renovar meu acompanhamento</a>
<p style="font-size:14px;line-height:1.6;color:#555;margin:26px 0 0">Após a compra, o pagamento será conferido e o novo período será liberado. Em caso de dúvida sobre qual plano escolher, fale comigo pelo WhatsApp.</p>
<p style="font-size:13px;line-height:1.5;color:#777;margin:24px 0 0">Esta é uma mensagem automática relacionada à vigência da sua consultoria.</p>
</td></tr></table>
</td></tr></table></body></html>`,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) return json({ error: result.message || "Falha no envio." }, 502);
  return json({ ok: true, id: result.id });
});
