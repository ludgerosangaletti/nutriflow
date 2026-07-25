import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

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
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
  if (error || !user?.email || user.email.toLowerCase() !== adminEmail) {
    return json({ error: "Acesso administrativo necessário." }, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    documentTitle?: string;
    version?: string;
  } | null;
  if (!body?.email || !body.name || !body.documentTitle) {
    return json({ error: "Dados inválidos." }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return json({ error: "E-mail não configurado." }, 500);

  const firstName = escapeHtml(body.name.trim().split(/\s+/)[0] || "paciente");
  const title = escapeHtml(body.documentTitle);
  const version = escapeHtml(body.version || "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [body.email],
      subject: "Seu protocolo está disponível na Área do Paciente",
      html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">CONSULTORIA NUTRICIONAL</div><div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div></td></tr>
<tr><td style="padding:34px"><h1 style="font-size:25px;margin:0 0 18px">Seu material está disponível!</h1>
<p style="font-size:16px;line-height:1.6">Olá, ${firstName}.</p>
<p style="font-size:16px;line-height:1.6">O documento <strong>${title}</strong>${version ? ` — versão ${version}` : ""} foi publicado na sua Área do Paciente.</p>
<a href="https://ludgerosangaletti.com.br/documentos" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px;margin-top:10px">Acessar meus documentos</a>
<p style="font-size:13px;line-height:1.5;color:#666;margin:28px 0 0">Use o mesmo e-mail e senha cadastrados no site. Esta é uma mensagem automática.</p>
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
