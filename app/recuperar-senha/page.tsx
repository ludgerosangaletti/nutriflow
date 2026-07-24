"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../supabase/client";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/nova-senha`;
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
    setMessage(error ? "Não foi possível enviar. Tente novamente." : "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
    setLoading(false);
  }

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Recuperar acesso</p>
          <h1>Redefina sua senha.</h1>
          <p>Enviaremos um link seguro para o seu e-mail.</p>
        </div>
        <form className="signup-card" onSubmit={submit}>
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {message ? <p className="auth-message">{message}</p> : null}
          <button className="checkout-button" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</button>
          <small><a className="inline-auth-link" href="/entrar">Voltar para entrar</a></small>
        </form>
      </section>
    </main>
  );
}
