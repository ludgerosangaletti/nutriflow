"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../supabase/client";

export default function PresentialProfileForm({ email }: { email: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("As senhas informadas não são iguais.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          name: `${firstName} ${lastName}`.trim(),
          whatsapp,
          birth_date: birthDate,
          modality: "in_person",
          privacy_policy_version: "2026-07-28",
          privacy_accepted_at: new Date().toISOString(),
        },
      });
      if (updateError) throw updateError;
      const response = await fetch("/api/perfil-presencial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, birthDate, whatsapp }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir o cadastro.");
      window.location.assign("/area-cliente");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível concluir o cadastro.",
      );
      setSaving(false);
    }
  }

  return (
    <form className="signup-card in-person-profile-form" onSubmit={submit}>
      <div className="profile-name-grid">
        <label>
          Nome
          <input
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
            required
            value={firstName}
          />
        </label>
        <label>
          Sobrenome
          <input
            autoComplete="family-name"
            onChange={(event) => setLastName(event.target.value)}
            required
            value={lastName}
          />
        </label>
      </div>
      <label>
        E-mail confirmado
        <input disabled type="email" value={email} />
      </label>
      <label>
        Data de nascimento
        <input
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setBirthDate(event.target.value)}
          required
          type="date"
          value={birthDate}
        />
      </label>
      <label>
        WhatsApp
        <input
          autoComplete="tel"
          inputMode="tel"
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="(00) 00000-0000"
          required
          value={whatsapp}
        />
      </label>
      <div className="profile-name-grid">
        <label>
          Crie uma senha
          <input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo de 8 caracteres"
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          Confirme a senha
          <input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
      </div>
      <label className="signup-consent">
        <input
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          required
          type="checkbox"
        />
        <span>
          Li e aceito a{" "}
          <a href="/politica-de-privacidade" target="_blank">
            Política de Privacidade
          </a>{" "}
          e os{" "}
          <a href="/termos-de-uso" target="_blank">
            Termos de Uso
          </a>
          .
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="checkout-button" disabled={!accepted || saving}>
        {saving ? "Concluindo seu cadastro..." : "Criar conta e acessar"}
      </button>
    </form>
  );
}
