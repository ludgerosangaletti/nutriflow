import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimEmailDelivery, markEmailFailed, markEmailSent, resendHeaders } from "../_shared/communication-delivery.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
  if (authError || !user?.email || user.email.toLowerCase() !== adminEmail) {
    return json({ error: "Acesso administrativo necessário." }, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    plan?: string;
  } | null;
  if (!body?.email || !body.name || !body.email.includes("@")) {
    return json({ error: "Dados do paciente inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) {
    return json({ error: "Configuração de e-mail incompleta." }, 500);
  }
  const deliveryKey = `payment-approved:${body.email.toLowerCase()}:${body.plan || "default"}`;
  const claim = await claimEmailDelivery({ key: deliveryKey, type: "payment-approved", recipient: body.email.toLowerCase() });
  if (!claim.claimed) return json({ ok: true, duplicate: true });

  const firstName = escapeHtml(body.name.trim().split(/\s+/)[0] || "paciente");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      ...resendHeaders(apiKey, deliveryKey),
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [body.email],
      subject: "Pagamento confirmado — sua anamnese está disponível",
      html: `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff">
<div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">CONSULTORIA NUTRICIONAL</div>
<div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div>
</td></tr>
<tr><td style="padding:34px">
<h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">Pagamento confirmado!</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Olá, ${firstName}.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Seu pagamento foi aprovado e sua anamnese já está disponível. Entre na Área do Paciente para responder às perguntas que vão orientar sua estratégia alimentar.</p>
<a href="https://ludgerosangaletti.com.br/area-cliente" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px">Preencher minha anamnese</a>
<p style="font-size:13px;line-height:1.5;color:#666;margin:28px 0 0">Use o mesmo e-mail e a senha cadastrados no site. Esta é uma mensagem automática; não é necessário respondê-la.</p>
</td></tr></table>
</td></tr></table></body></html>`,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    await markEmailFailed(deliveryKey, `RESEND_${response.status}`);
    return json({ error: result.message || "O provedor recusou o envio." }, 502);
  }
  await markEmailSent(deliveryKey, result.id || null);
  return json({ ok: true, id: result.id });
});
