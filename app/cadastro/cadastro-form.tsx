"use client";

import { FormEvent, useState } from "react";
import type { PlanId } from "../plans";
import { createClient } from "../supabase/client";

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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/pagamento?plano=${plan}`)}`;
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { name, whatsapp, plan },
      },
    });
    if (signupError) {
      setError(
        signupError.message.toLowerCase().includes("already")
          ? "Este e-mail já possui uma conta. Entre para continuar."
          : "Não foi possível criar a conta. Confira os dados e tente novamente.",
      );
      setSaving(false);
      return;
    }
    setSaving(false);
    setSent(true);
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
          Autorizo o uso destes dados para identificação da compra e prestação
          da consultoria nutricional.
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
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
