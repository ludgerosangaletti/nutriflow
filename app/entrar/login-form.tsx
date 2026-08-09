"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../supabase/client";

export default function LoginForm({
  next,
  confirmationError,
  appMode = false,
}: {
  next: string;
  confirmationError: boolean;
  appMode?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    confirmationError ? "O link de confirmação é inválido ou expirou." : "",
  );
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"standalone" | "browser" | null>(null);
  const [appPhase, setAppPhase] = useState<"splash" | "login">("splash");

  useEffect(() => {
    let active = true;
    if (appMode) {
      const startedAt = Date.now();
      createClient().auth.getSession().then(({ data }) => {
        if (!active) return;
        const wait = Math.max(0, 450 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (!active) return;
          if (data.session) window.location.replace(next);
          else setAppPhase("login");
        }, wait);
      }).catch(() => {
        if (active) setAppPhase("login");
      });
      return () => { active = false; };
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this legacy flag instead of display-mode.
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setDisplayMode(standalone ? "standalone" : "browser");
    return () => { active = false; };
  }, [appMode, next]);

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

  if (appMode && appPhase === "splash") {
    return <div className="app-login-splash" role="status" aria-label="Carregando o NutriFlow"><img src="/icons/splash-mark-512.png" alt="" /><span className="app-login-loader" /></div>;
  }

  if (!appMode && displayMode === null) {
    return <div className="app-login-splash" role="status" aria-label="Carregando o NutriFlow"><img src="/icons/splash-mark-512.png" alt="" /><span className="app-login-loader" /></div>;
  }

  if (appMode || displayMode === "standalone") {
    return (
      <form className="app-login-card" onSubmit={submit}>
        <div className="app-login-brand"><img src="/icons/splash-mark-512.png" alt="Ludgero Sangaletti" /><span>NutriFlow</span><p>Seu acompanhamento nutricional, organizado.</p></div>
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
