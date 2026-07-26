import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const responseHeaders = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });

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
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return json({ error: "Sessão inválida." }, 401);

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    whatsapp?: string;
    plan?: string;
    price?: string;
  } | null;
  if (
    !body?.email ||
    user.email.toLowerCase() !== body.email.toLowerCase() ||
    !body.name ||
    !body.plan
  ) {
    return json({ error: "Dados do paciente inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!apiKey || !fromEmail || !adminEmail) {
    return json({ error: "Configuração de e-mail incompleta." }, 500);
  }

  const name = escapeHtml(body.name);
  const email = escapeHtml(body.email);
  const whatsapp = escapeHtml(body.whatsapp || "Não informado");
  const plan = escapeHtml(body.plan);
  const price = escapeHtml(body.price || "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Consultoria Ludgero Sangaletti <${fromEmail}>`,
      to: [adminEmail],
      subject: `Nova compra iniciada — ${name} — confira na TON`,
      html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">ALERTA ADMINISTRATIVO</div><div style="font-size:24px;font-weight:800;margin-top:8px">Nova compra iniciada</div></td></tr>
<tr><td style="padding:34px">
<p style="font-size:16px;line-height:1.6;margin-top:0"><strong>Importante:</strong> este aviso indica que o paciente abriu o pagamento. Confira o recebimento no aplicativo TON antes de liberar o acesso.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;border-radius:12px;padding:18px">
<tr><td style="padding:7px"><strong>Paciente</strong></td><td style="padding:7px">${name}</td></tr>
<tr><td style="padding:7px"><strong>E-mail</strong></td><td style="padding:7px">${email}</td></tr>
<tr><td style="padding:7px"><strong>WhatsApp</strong></td><td style="padding:7px">${whatsapp}</td></tr>
<tr><td style="padding:7px"><strong>Plano</strong></td><td style="padding:7px">${plan}${price ? ` — ${price}` : ""}</td></tr>
</table>
<a href="https://ludgerosangaletti.com.br/admin/clientes" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:22px">Abrir painel administrativo</a>
<p style="font-size:13px;line-height:1.5;color:#666;margin:26px 0 0">Após localizar o pagamento na TON, clique em “Confirmar pagamento” no painel.</p>
</td></tr></table></td></tr></table></body></html>`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) return json({ error: result.message || "Falha no envio." }, 502);
  return json({ ok: true, id: result.id });
});
