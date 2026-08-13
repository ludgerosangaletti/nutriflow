"use client";

import { FormEvent, useState } from "react";
import type { PlanId } from "../plans";
import { signupErrorMessage, withAuthTimeout } from "../supabase/auth-timeout";
import { createClient } from "../supabase/client";
import { WHATSAPP_ACTIVATION_CONSENT_TEXT, WHATSAPP_ACTIVATION_CONSENT_VERSION } from "../whatsapp-activation-consent";

export default function CadastroForm({
  plan,
}: {
  plan: PlanId;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSlow(false);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/pagamento?plano=${plan}`)}`;
    const slowTimer = setTimeout(() => setSlow(true), 8_000);
    try {
      const { error: signupError } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              name,
              whatsapp,
              plan,
              privacy_policy_version: "2026-07-28",
              privacy_accepted_at: new Date().toISOString(),
              whatsapp_operational_opt_in: whatsappOptIn,
              whatsapp_operational_opt_in_at: whatsappOptIn ? new Date().toISOString() : null,
              whatsapp_operational_opt_in_version: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_VERSION : null,
              whatsapp_operational_opt_in_text: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_TEXT : null,
            },
          },
        }),
      );
      if (signupError) throw signupError;
      setSent(true);
    } catch (signupFailure) {
      console.error("Falha no cadastro Supabase:", signupFailure);
      setError(signupErrorMessage(signupFailure));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="signup-card auth-success">
        <span className="auth-success-icon">✓</span>
        <h2>Confirme seu e-mail</h2>
        <p>
          Enviamos uma mensagem para <strong>{email}</strong>. Abra o link de
          confirmação para continuar ao pagamento.
        </p>
        <small>Verifique também a caixa de spam ou lixo eletrônico.</small>
      </div>
    );
  }

  return (
    <form className="signup-card" onSubmit={submit}>
      <label>
        Nome completo
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </label>
      <label>
        E-mail do acesso
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label>
        WhatsApp
        <input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="(00) 00000-0000"
          inputMode="tel"
          autoComplete="tel"
          required
        />
      </label>
      <label>
        Crie uma senha
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo de 8 caracteres"
          required
        />
      </label>
      <label className="signup-consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          required
        />
        <span>
          Li e aceito a <a href="/politica-de-privacidade" target="_blank">Política de Privacidade</a>{" "}
          e os <a href="/termos-de-uso" target="_blank">Termos de Uso</a>. Autorizo
          o tratamento destes dados para cadastro, identificação da compra e
          prestação da consultoria nutricional.
        </span>
      </label>
      <label className="signup-consent">
        <input type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />
        <span>
          Autorizo avisos operacionais pelo WhatsApp, incluindo a confirmação de que minha dieta ou meu treino estão disponíveis no aplicativo. Posso cancelar essa autorização a qualquer momento.
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {slow ? (
        <p className="auth-message">
          A comunicação está demorando mais que o normal. Aguarde; esta
          tentativa será encerrada automaticamente.
        </p>
      ) : null}
      <button className="checkout-button" disabled={!accepted || saving}>
        {saving ? "Criando sua conta..." : "Criar conta e confirmar e-mail"}
      </button>
      <small>
        O pagamento será processado pela TON. Nenhum dado do cartão é armazenado
        neste site.
      </small>
      <small>
        Já possui uma conta? <a className="inline-auth-link" href={`/entrar?next=${encodeURIComponent(`/pagamento?plano=${plan}`)}`}>Entrar</a>
      </small>
    </form>
  );
}
