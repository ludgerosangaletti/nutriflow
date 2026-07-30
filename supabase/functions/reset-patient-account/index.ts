import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    userId?: string | null;
  } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) {
    return json({ error: "E-mail do paciente inválido." }, 400);
  }
  if (email === adminEmail) {
    return json({ error: "A conta administrativa não pode ser excluída." }, 400);
  }

  const service = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let userId = String(body?.userId || "").trim();

  if (!userId) {
    const {
      data: { users },
      error: listError,
    } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return json({ error: listError.message }, 502);
    }
    userId =
      users.find((user) => user.email?.toLowerCase() === email)?.id || "";
  }

  if (userId) {
    const { error: deleteError } = await service.auth.admin.deleteUser(
      userId,
      false,
    );
    if (deleteError && !/not found/i.test(deleteError.message)) {
      return json({ error: deleteError.message }, 502);
    }
  }

  return json({ ok: true, deleted: true });
});
