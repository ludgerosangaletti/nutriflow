"use client";

import { FormEvent, useState } from "react";

type Props = {
  email: string;
  inviteStatus: string;
  plan: string;
  accessStartedAt: string | null;
  nextAppointmentAt: string | null;
  appointmentLocation: string | null;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function InPersonCareManager(props: Props) {
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [nextAppointmentAt, setNextAppointmentAt] = useState(
    localDateTime(props.nextAppointmentAt),
  );
  const [showEmailCorrection, setShowEmailCorrection] = useState(false);

  async function request(payload: Record<string, unknown>) {
    const action = String(payload.action);
    setSaving(action);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pacientes-presenciais", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: props.email, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        nextEmail?: string;
        warning?: string;
        invite?: { id?: string; sent?: boolean; whatsapp?: string };
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a ação.");
      if (action === "correct_email") {
        setMessage(result.warning || "E-mail de acesso corrigido com sucesso.");
        if (result.nextEmail) {
          window.setTimeout(() => {
            window.location.assign(`/admin/clientes/${encodeURIComponent(result.nextEmail!)}`);
          }, 1100);
        }
        return;
      }
      if (action === "resend_invite") {
        setMessage(
          result.invite?.whatsapp === "sent"
            ? "Convite reenviado por e-mail e WhatsApp."
            : "Convite reenviado por e-mail. O WhatsApp ainda não foi entregue.",
        );
        return;
      }
      setMessage(
        action === "end_access"
          ? "Acesso encerrado com sucesso."
          : "Dados do atendimento atualizados com sucesso.",
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setSaving("");
    }
  }

  async function updateCare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request({
      action: "update_care",
      plan: form.get("plan"),
      startsAt: `${form.get("startsAt")}T12:00:00Z`,
      nextAppointmentAt: form.get("nextAppointmentAt")
        ? new Date(String(form.get("nextAppointmentAt"))).toISOString()
        : null,
      appointmentLocation: form.get("appointmentLocation"),
    });
  }

  async function correctEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newEmail = String(form.get("newEmail") || "").trim().toLowerCase();
    const confirmation = String(form.get("emailConfirmation") || "").trim().toLowerCase();
    if (newEmail !== confirmation) {
      setMessage("A confirmação deve ser igual ao novo e-mail.");
      return;
    }
    if (!window.confirm(`Corrigir o e-mail de acesso para ${newEmail}?`)) return;
    await request({ action: "correct_email", newEmail, emailConfirmation: confirmation });
  }

  return (
    <section className="in-person-care-manager">
      <header>
        <div>
          <span>Gestão do atendimento presencial</span>
          <h2>Vigência, consulta e acesso</h2>
        </div>
        <b>{props.inviteStatus === "accepted" ? "Conta ativa" : "Convite pendente"}</b>
      </header>
      <form onSubmit={updateCare}>
        <label>
          Plano
          <select defaultValue={props.plan} name="plan">
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
          </select>
        </label>
        <label>
          Início da vigência
          <input
            defaultValue={(props.accessStartedAt || new Date().toISOString()).slice(0, 10)}
            name="startsAt"
            required
            type="date"
          />
        </label>
        <label>
          Próxima consulta
          <input
            onChange={(event) => setNextAppointmentAt(event.target.value)}
            name="nextAppointmentAt"
            type="datetime-local"
            value={nextAppointmentAt}
          />
          <span
            className={`appointment-field-status ${nextAppointmentAt ? "is-scheduled" : "is-unscheduled"}`}
          >
            {nextAppointmentAt ? "Consulta agendada" : "Não agendada"}
          </span>
        </label>
        <label>
          Local
          <input
            defaultValue={props.appointmentLocation || "Guarapuava — PR"}
            name="appointmentLocation"
          />
        </label>
        <button className="admin-action" disabled={Boolean(saving)}>
          {saving === "update_care" ? "Salvando..." : "Salvar atendimento"}
        </button>
      </form>
      <div className="in-person-care-actions">
        <button
          disabled={Boolean(saving)}
          onClick={() => request({ action: "resend_invite" })}
          type="button"
        >
          {saving === "resend_invite" ? "Reenviando..." : "Reenviar convite"}
        </button>
        <button
          disabled={Boolean(saving)}
          onClick={() => setShowEmailCorrection((visible) => !visible)}
          type="button"
        >
          Corrigir e-mail de acesso
        </button>
        <button
          className="is-danger"
          disabled={Boolean(saving)}
          onClick={() => {
            if (window.confirm("Encerrar agora o acesso deste paciente?")) {
              request({ action: "end_access" });
            }
          }}
          type="button"
        >
          Encerrar acesso
        </button>
      </div>
      {showEmailCorrection ? (
        <form className="in-person-email-correction" onSubmit={correctEmail}>
          <div>
            <strong>Corrigir e-mail de acesso</strong>
            <small>O prontuário será preservado. Convites pendentes serão substituídos por um novo link.</small>
          </div>
          <label>
            E-mail atual
            <input readOnly type="email" value={props.email} />
          </label>
          <label>
            Novo e-mail
            <input autoComplete="off" name="newEmail" required type="email" />
          </label>
          <label>
            Confirme o novo e-mail
            <input autoComplete="off" name="emailConfirmation" required type="email" />
          </label>
          <button className="admin-action" disabled={Boolean(saving)}>
            {saving === "correct_email" ? "Corrigindo..." : "Confirmar correção"}
          </button>
        </form>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
