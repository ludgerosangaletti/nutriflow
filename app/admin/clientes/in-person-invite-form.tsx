"use client";

import { FormEvent, useState } from "react";

export default function InPersonInviteForm() {
  const today = new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/pacientes-presenciais", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          plan: form.get("plan"),
          startsAt: `${form.get("startsAt")}T12:00:00Z`,
          nextAppointmentAt: form.get("nextAppointmentAt")
            ? new Date(String(form.get("nextAppointmentAt"))).toISOString()
            : "",
          appointmentLocation: form.get("appointmentLocation"),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o convite.");
      setMessage("Paciente cadastrado e convite enviado por e-mail.");
      event.currentTarget.reset();
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o convite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="in-person-invite-form" onSubmit={submit}>
      <div>
        <label>
          E-mail do paciente
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Plano
          <select defaultValue="mensal" name="plan">
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
          </select>
        </label>
        <label>
          Início da vigência
          <input defaultValue={today} name="startsAt" required type="date" />
        </label>
        <label>
          Próxima consulta
          <input name="nextAppointmentAt" type="datetime-local" />
        </label>
        <label className="invite-location-field">
          Local do atendimento
          <input
            defaultValue="Guarapuava — PR"
            maxLength={180}
            name="appointmentLocation"
          />
        </label>
      </div>
      <button className="admin-action" disabled={saving}>
        {saving ? "Enviando convite..." : "Cadastrar e enviar convite"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
