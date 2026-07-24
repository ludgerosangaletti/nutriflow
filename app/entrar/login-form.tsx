"use client";

import { FormEvent, useState } from "react";
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
