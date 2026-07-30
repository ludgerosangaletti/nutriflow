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
    modality?: string;
  } | null;
  if (!body?.email || !body.email.includes("@") || !body.name) {
    return json({ error: "Dados do paciente inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return json({ error: "E-mail não configurado." }, 500);

  const firstName = escapeHtml(body.name.trim().split(/\s+/)[0] || "paciente");
  const context =
    body.modality === "in_person"
      ? "Ele ajuda a acompanhar como você está entre as consultas presenciais e sinaliza pontos que merecem atenção no próximo retorno."
      : "Ele ajuda a acompanhar sua evolução, identificar dificuldades e orientar os próximos ajustes da sua estratégia alimentar.";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [body.email],
      subject: "Seu check-in semanal já está disponível",
      html: `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff">
<div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">ACOMPANHAMENTO SEMANAL</div>
<div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div>
</td></tr>
<tr><td style="padding:34px">
<h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">Como foi sua semana?</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Olá, ${firstName}!</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Seu check-in desta semana já está disponível na Área do Paciente.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">O preenchimento leva cerca de 3 minutos. ${context}</p>
<a href="https://ludgerosangaletti.com.br/check-in" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px">Preencher check-in semanal</a>
<p style="font-size:14px;line-height:1.6;color:#555;margin:26px 0 0">Responda considerando como foram seus últimos sete dias. Quanto mais sinceras e completas forem as informações, mais individualizado poderá ser o acompanhamento.</p>
<p style="font-size:13px;line-height:1.5;color:#777;margin:24px 0 0">Esta é uma mensagem automática enviada somente durante a vigência do seu plano. Não é necessário respondê-la.</p>
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
