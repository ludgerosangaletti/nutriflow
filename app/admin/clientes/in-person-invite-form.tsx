"use client";

import { FormEvent, useState } from "react";

export default function InPersonInviteForm() {
  const today = new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/admin/pacientes-presenciais", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          whatsapp: form.get("whatsapp"),
          whatsappOptIn: form.get("whatsappOptIn") === "on",
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
        warning?: string;
        patient?: { anamnesisUrl?: string };
        invite?: { id?: string; sent?: boolean };
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o convite.");
      setMessage(result.warning || "Paciente cadastrado. Abrindo a anamnese clínica…");
      if (result.patient?.anamnesisUrl) window.location.assign(result.patient.anamnesisUrl);
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
          Nome do paciente
          <input autoComplete="name" maxLength={160} name="name" required />
        </label>
        <label>
          E-mail do paciente
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          WhatsApp
          <input
            autoComplete="tel"
            inputMode="tel"
            name="whatsapp"
            placeholder="(42) 99999-9999"
            required
          />
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
        <label className="invite-location-field invite-whatsapp-consent">
          <input name="whatsappOptIn" required type="checkbox" />
          Confirmo que o paciente autorizou mensagens transacionais no WhatsApp
          sobre ativação da conta e acompanhamento presencial.
        </label>
      </div>
      <button className="admin-action" disabled={saving}>
        {saving ? "Criando prontuário..." : "Criar prontuário e enviar convite"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
