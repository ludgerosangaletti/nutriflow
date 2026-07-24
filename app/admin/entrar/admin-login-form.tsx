"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "../../supabase/client";

export default function AdminLoginForm({
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
        E-mail administrativo
        <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Senha
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="checkout-button" disabled={loading}>
        {loading ? "Entrando..." : "Entrar no painel"}
      </button>
      <small><Link className="inline-auth-link" href="/recuperar-senha">Esqueci minha senha</Link></small>
      <small>Primeiro acesso? <Link className="inline-auth-link" href="/admin/primeiro-acesso">Criar conta administrativa</Link></small>
    </form>
  );
}
