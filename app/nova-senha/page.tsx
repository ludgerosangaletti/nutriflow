"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../supabase/client";

export default function NewPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMessage("O link expirou ou a senha não pôde ser atualizada.");
      setLoading(false);
      return;
    }
    window.location.assign("/area-cliente");
  }

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Nova senha</p>
          <h1>Crie uma senha segura.</h1>
          <p>Use pelo menos oito caracteres.</p>
        </div>
        <form className="signup-card" onSubmit={submit}>
          <label>Nova senha<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {message ? <p className="form-error">{message}</p> : null}
          <button className="checkout-button" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
        </form>
      </section>
    </main>
  );
}
