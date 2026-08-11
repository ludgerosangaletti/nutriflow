import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user: adminUser }, error: authError } = await userClient.auth.getUser(token);
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
  if (authError || !adminUser?.email || adminUser.email.toLowerCase() !== adminEmail) {
    return json({ error: "Acesso administrativo necessário." }, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "prepare" | "finalize" | "rollback";
    currentEmail?: string;
    newEmail?: string;
    userId?: string | null;
    accountActive?: boolean;
  } | null;
  const action = body?.action;
  const currentEmail = String(body?.currentEmail || "").trim().toLowerCase();
  const newEmail = String(body?.newEmail || "").trim().toLowerCase();
  if (!action || !validEmail(currentEmail) || !validEmail(newEmail) || currentEmail === newEmail || newEmail === adminEmail) {
    return json({ error: "Dados da correção de e-mail são inválidos." }, 400);
  }

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { users }, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return json({ error: listError.message }, 502);
  let target = body?.userId ? users.find((user) => user.id === body.userId) : undefined;
  target ||= users.find((user) => user.email?.toLowerCase() === currentEmail);
  const collision = users.find((user) => user.email?.toLowerCase() === newEmail && user.id !== target?.id);
  if (collision) return json({ error: "Este e-mail já pertence a outra conta de acesso." }, 409);

  if (action === "prepare" || action === "rollback") {
    if (!target) {
      if (body?.accountActive) return json({ error: "A conta ativa do paciente não foi localizada." }, 404);
      return json({ ok: true, userId: null, authChanged: false });
    }
    const { data, error } = await service.auth.admin.updateUserById(target.id, { email: newEmail, email_confirm: true });
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true, userId: data.user.id, authChanged: true });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return json({ error: "Configuração de e-mail incompleta." }, 500);
  let actionHtml = "";
  let subject = "Seu e-mail de acesso foi corrigido";
  if (!body?.accountActive) {
    const link = await service.auth.admin.generateLink({
      type: target ? "magiclink" : "invite",
      email: newEmail,
      options: { redirectTo: "https://ludgerosangaletti.com.br/auth/callback?next=/primeiro-acesso", data: { modality: "in_person", profile_pending: true } },
    });
    const tokenHash = link.data.properties?.hashed_token;
    if (link.error || !tokenHash) return json({ error: link.error?.message || "Não foi possível criar o novo convite." }, 502);
    const type = target ? "magiclink" : "invite";
    const href = escapeHtml(`https://ludgerosangaletti.com.br/ativar-conta?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`);
    subject = "Novo acesso à sua Área do Paciente";
    actionHtml = `<p style="margin:24px 0"><a href="${href}" style="background:#ffeb00;color:#111;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:10px">Acessar minha conta</a></p>`;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `Ludgero Sangaletti <${fromEmail}>`,
      to: [newEmail],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px"><h1 style="font-size:24px">E-mail de acesso atualizado</h1><p style="font-size:16px;line-height:1.6">Seu endereço de acesso à Área do Paciente foi corrigido com segurança.</p>${actionHtml}<p style="color:#666;font-size:13px">Se você não reconhece esta alteração, entre em contato com Ludgero Sangaletti.</p></div>`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) return json({ error: result.message || "A notificação não foi enviada." }, 502);
  return json({ ok: true, notificationSent: true });
});
