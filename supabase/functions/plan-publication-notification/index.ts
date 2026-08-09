import { claimEmailDelivery, markEmailFailed, markEmailSent, resendHeaders } from "../_shared/communication-delivery.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const secret = Deno.env.get("NUTRIFLOW_NOTIFICATION_SECRET");
  if (!secret || request.headers.get("x-nutriflow-secret") !== secret) return json({ error: "Não autorizado." }, 401);
  const body = await request.json().catch(() => null) as { email?: string; name?: string; whatsapp?: string; portalUrl?: string; publicationPublicId?: string } | null;
  if (!body?.email || !body.publicationPublicId) return json({ error: "Dados inválidos." }, 400);
  const resendKey = Deno.env.get("RESEND_API_KEY"); const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (resendKey && from) {
    const deliveryKey = `plan-publication:${body.email.toLowerCase()}:${body.publicationPublicId}`;
    const claim = await claimEmailDelivery({ key: deliveryKey, type: "plan-publication", recipient: body.email.toLowerCase() });
    if (claim.claimed) {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: resendHeaders(resendKey, deliveryKey), body: JSON.stringify({ from: `Ludgero Sangaletti <${from}>`, to: [body.email], subject: "Seu novo plano alimentar está disponível", html: `<p>Olá, ${(body.name || "paciente").split(/\s+/)[0]}.</p><p>Seu plano alimentar foi publicado e já está disponível na Área do Paciente.</p><p><a href="${body.portalUrl || "https://ludgerosangaletti.com.br/plano-alimentar"}">Acessar meu plano</a></p>` }) });
      const result = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok) await markEmailFailed(deliveryKey, `RESEND_${response.status}`); else await markEmailSent(deliveryKey, result.id || null);
    }
  }
  const token = Deno.env.get("META_ACCESS_TOKEN"); const phoneId = Deno.env.get("META_PHONE_NUMBER_ID");
  if (token && phoneId && body.whatsapp) await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: body.whatsapp.replace(/\D/g, ""), type: "text", text: { body: "Seu novo plano alimentar está disponível na Área do Paciente. Acesse: https://ludgerosangaletti.com.br/plano-alimentar" } }) });
  return json({ ok: true, publicationPublicId: body.publicationPublicId });
});
