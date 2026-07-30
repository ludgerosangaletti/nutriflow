"use client";

import { useState } from "react";
import { formatAppointment } from "../../../appointment-scheduling";

type RequestItem = {
  id: number;
  action: string;
  currentAppointmentAt: string;
  requestedAppointmentAt: string | null;
  status: string;
  createdAt: string;
};

export default function AppointmentRequests({
  email,
  requests,
  appointmentStatus,
}: {
  email: string;
  requests: RequestItem[];
  appointmentStatus: string;
}) {
  const [saving, setSaving] = useState(0);
  const [message, setMessage] = useState("");
  const pending = requests.filter((item) => item.status === "pending");

  async function decide(requestId: number, approve: boolean) {
    setSaving(requestId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pacientes-presenciais", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          requestId,
          action: approve
            ? "approve_appointment_request"
            : "reject_appointment_request",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(result.error || "Ação não concluída.");
      setMessage(result.message || "Solicitação atualizada.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ação não concluída.");
    } finally {
      setSaving(0);
    }
  }

  return (
    <section className="appointment-requests">
      <header>
        <div>
          <span>Confirmação pelo chatbot</span>
          <h3>Retorno e remarcações</h3>
        </div>
        <b>{pending.length ? `${pending.length} pendente(s)` : appointmentStatus}</b>
      </header>
      {!pending.length ? (
        <p>Nenhuma solicitação aguardando sua decisão.</p>
      ) : (
        <div>
          {pending.map((item) => (
            <article key={item.id}>
              <div>
                <strong>
                  {item.action === "cancel"
                    ? "Cancelamento solicitado"
                    : "Novo horário solicitado"}
                </strong>
                <small>
                  Atual: {formatAppointment(item.currentAppointmentAt)}
                </small>
                {item.requestedAppointmentAt ? (
                  <b>Novo: {formatAppointment(item.requestedAppointmentAt)}</b>
                ) : null}
              </div>
              <nav>
                <button
                  disabled={Boolean(saving)}
                  onClick={() => decide(item.id, true)}
                  type="button"
                >
                  {saving === item.id ? "Salvando..." : "Aprovar"}
                </button>
                <button
                  className="is-danger"
                  disabled={Boolean(saving)}
                  onClick={() => decide(item.id, false)}
                  type="button"
                >
                  Recusar
                </button>
              </nav>
            </article>
          ))}
        </div>
      )}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
