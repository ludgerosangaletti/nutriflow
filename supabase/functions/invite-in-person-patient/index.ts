import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    resend?: boolean;
    systemReminder?: boolean;
  } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail do paciente inválido." }, 400);
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = Deno.env.get("CHECKIN_REMINDER_SECRET") || "";
  const systemAuthorized = Boolean(
    body?.systemReminder &&
      expectedSecret &&
      safeEqual(suppliedSecret, expectedSecret),
  );

  if (!systemAuthorized) {
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const {
      data: { user: adminUser },
      error: authError,
    } = await userClient.auth.getUser(token);
    const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
    if (
      authError ||
      !adminUser?.email ||
      adminUser.email.toLowerCase() !== adminEmail
    ) {
      return json({ error: "Acesso administrativo necessário." }, 403);
    }
  }

  const service = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const redirectTo =
    "https://ludgerosangaletti.com.br/auth/callback?next=/primeiro-acesso";
  let linkType: "invite" | "magiclink" = body?.resend || body?.systemReminder
    ? "magiclink"
    : "invite";
  let linkResult = await service.auth.admin.generateLink({
    type: linkType,
    email,
    options: {
      redirectTo,
      data: { modality: "in_person", profile_pending: true },
    },
  });
  if (linkResult.error && !body?.resend) {
    linkType = "magiclink";
    linkResult = await service.auth.admin.generateLink({
      type: linkType,
      email,
      options: { redirectTo },
    });
  }
  const tokenHash = linkResult.data.properties?.hashed_token;
  if (linkResult.error || !tokenHash) {
    return json(
      { error: linkResult.error?.message || "Não foi possível criar o convite." },
      502,
    );
  }

  const activationPath =
    `/ativar-conta?token_hash=${encodeURIComponent(tokenHash)}&type=${linkType}`;
  if (systemAuthorized) return json({ ok: true, activationPath });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) {
    return json({ error: "Configuração de e-mail incompleta." }, 500);
  }

  const actionLink = escapeHtml(
    `https://ludgerosangaletti.com.br${activationPath}`,
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [email],
      subject: body?.resend
        ? "Novo acesso à sua Área do Paciente"
        : "Seu acompanhamento presencial agora tem uma Área do Paciente",
      html: `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:28px 34px;color:#fff"><div style="color:#ffeb00;font-size:12px;font-weight:800;letter-spacing:1.2px">ATENDIMENTO PRESENCIAL</div><div style="font-size:24px;font-weight:800;margin-top:8px">Ludgero Sangaletti</div></td></tr>
<tr><td style="padding:34px">
<h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">${body?.resend ? "Seu novo link de acesso está disponível" : "Bem-vindo à sua Área do Paciente"}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Olá!</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Seu acompanhamento presencial também conta com um espaço digital para acessar o protocolo alimentar, avaliações físicas, check-ins, fotos e solicitações de ajustes.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Clique abaixo para confirmar seu e-mail, preencher seus dados e cadastrar uma senha.</p>
<a href="${actionLink}" style="display:inline-block;background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:10px">Criar minha conta</a>
<p style="font-size:13px;line-height:1.5;color:#666;margin:28px 0 0">Por segurança, este link é individual. Se você não reconhece este convite, ignore esta mensagem.</p>
</td></tr></table></td></tr></table></body></html>`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    return json({ error: result.message || "O provedor recusou o envio." }, 502);
  }
  return json({ ok: true, id: result.id, activationPath });
});
