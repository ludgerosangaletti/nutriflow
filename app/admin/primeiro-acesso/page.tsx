"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signupErrorMessage, withAuthTimeout } from "../../supabase/auth-timeout";
import { createClient } from "../../supabase/client";

export default function AdminFirstAccessPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSlow(false);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin/clientes`;
    const slowTimer = setTimeout(() => setSlow(true), 8_000);
    try {
      const { error: signupError } = await withAuthTimeout(
        createClient().auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { accountType: "admin" },
          },
        }),
      );
      if (signupError) throw signupError;
      setSent(true);
    } catch (signupFailure) {
      console.error("Falha no cadastro administrativo Supabase:", signupFailure);
      setError(signupErrorMessage(signupFailure));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="portal-shell auth-page">
        <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
        <section className="auth-layout">
          <div className="portal-copy">
            <p className="section-kicker">Primeiro acesso</p>
            <h1>Confirme seu e-mail.</h1>
            <p>Abra a mensagem enviada pelo Supabase para ativar sua conta administrativa.</p>
          </div>
          <div className="signup-card auth-success">
            <span className="auth-success-icon">✓</span>
            <h2>Mensagem enviada</h2>
            <p>Após confirmar, você será direcionado ao painel administrativo.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Primeiro acesso</p>
          <h1>Crie sua conta administrativa.</h1>
          <p>Use exatamente o e-mail autorizado para a gestão da consultoria.</p>
        </div>
        <form className="signup-card" onSubmit={submit}>
          <label>
            E-mail administrativo
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Crie uma senha
            <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {slow ? (
            <p className="auth-message">
              A comunicação está demorando mais que o normal. Aguarde; esta
              tentativa será encerrada automaticamente.
            </p>
          ) : null}
          <button className="checkout-button" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta administrativa"}
          </button>
          <small>Somente o e-mail previamente autorizado terá acesso aos dados dos pacientes.</small>
          <small><Link className="inline-auth-link" href="/admin/entrar">Voltar para entrar</Link></small>
        </form>
      </section>
    </main>
  );
}
