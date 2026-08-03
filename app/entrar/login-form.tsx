"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../supabase/client";

export default function LoginForm({
  next,
  confirmationError,
}: {
  next: string;
  confirmationError: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    confirmationError ? "O link de confirmação é inválido ou expirou." : "",
  );
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"standalone" | "browser" | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this legacy flag instead of display-mode.
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setDisplayMode(standalone ? "standalone" : "browser");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: loginError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setError("E-mail ou senha incorretos. Confirme também seu e-mail antes de entrar.");
      setLoading(false);
      return;
    }
    window.location.assign(next);
  }

  if (displayMode === null) {
    return <div className="app-login-splash" role="status" aria-label="Carregando o NutriFlow"><img src="/logo-ludgero.png" alt="" /><span className="app-login-loader" /></div>;
  }

  if (displayMode === "standalone") {
    return (
      <form className="app-login-card" onSubmit={submit}>
        <div className="app-login-brand"><img src="/logo-ludgero.png" alt="Ludgero Sangaletti" /><span>NutriFlow</span><p>Seu acompanhamento nutricional, organizado.</p></div>
        <label>E-mail<input className="app-login-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@email.com" /></label>
        <label>Senha<input className="app-login-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Sua senha" /></label>
        {error ? <p className="app-login-error" role="alert">{error}</p> : null}
        <button className="app-login-submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <a className="app-login-forgot" href="/recuperar-senha">Esqueci minha senha</a>
        <small>Nutrição Clínica &amp; Esportiva · CRN-8 11719</small>
      </form>
    );
  }

  return (
    <form className="signup-card" onSubmit={submit}>
      <label>
        E-mail
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Senha
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="checkout-button" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <small><a className="inline-auth-link" href="/recuperar-senha">Esqueci minha senha</a></small>
      <small>Ainda não tem conta? <Link className="inline-auth-link" href="/#comprar">Escolher um plano</Link></small>
    </form>
  );
}
