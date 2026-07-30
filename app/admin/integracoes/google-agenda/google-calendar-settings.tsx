"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  connected: boolean;
  calendarId: string;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

export default function GoogleCalendarSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/integracoes/google-agenda", {
      cache: "no-store",
    });
    const payload = (await response.json()) as Status;
    setStatus(payload);
  }

  useEffect(() => {
    void load();
    const query = new URLSearchParams(window.location.search);
    const error = query.get("error");
    if (query.get("connected") === "1") {
      setMessage("Conta Google autorizada. A conexão está pronta para sincronizar.");
    } else if (error === "state") {
      setMessage("A autorização expirou ou perdeu a validação de segurança. Inicie novamente.");
    } else if (error === "oauth") {
      setMessage("O Google autorizou o acesso, mas a conexão não foi concluída. Tente novamente.");
    } else if (error === "admin") {
      setMessage("Sua sessão administrativa expirou. Entre novamente antes de autorizar.");
    }
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const calendarId = String(form.get("calendarId") || "");
    const response = await fetch("/api/admin/integracoes/google-agenda", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_credentials",
        calendarId,
        clientId: form.get("clientId"),
        clientSecret: form.get("clientSecret"),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Não foi possível salvar as credenciais.");
      return;
    }
    setMessage("Credenciais protegidas e salvas. Agora autorize a agenda.");
    setStatus((current) => ({
      configured: true,
      connected: false,
      calendarId,
      status: "credentials_saved",
      connectedAt: current?.connectedAt || null,
      lastSyncAt: current?.lastSyncAt || null,
      lastSyncError: null,
    }));
    event.currentTarget.reset();
    await load();
  }

  async function sync() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/integracoes/google-agenda", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      events?: number;
      updated?: number;
      error?: string;
    };
    setSaving(false);
    setMessage(
      response.ok
        ? `Sincronização concluída: ${payload.events || 0} eventos consultados e ${payload.updated || 0} pacientes atualizados.`
        : payload.error || "Não foi possível sincronizar.",
    );
    await load();
  }

  return (
    <div className="google-calendar-settings">
      <section className="google-calendar-status">
        <div>
          <span>Estado da conexão</span>
          <strong>{status?.connected ? "Google Agenda conectado" : status?.configured ? "Aguardando autorização" : "Não configurado"}</strong>
          <p>Calendário: {status?.calendarId || "ainda não informado"}</p>
        </div>
        <b className={status?.connected ? "is-connected" : ""}>
          {status?.connected ? "Conectado" : "Pendente"}
        </b>
      </section>

      {!status?.connected ? (
        <form className="google-calendar-form" onSubmit={save}>
          <label>
            ID da agenda
            <input
              defaultValue="studio@cepefbrasil.page"
              name="calendarId"
              required
            />
          </label>
          <label>
            ID do cliente OAuth
            <input
              autoComplete="off"
              name="clientId"
              placeholder="...apps.googleusercontent.com"
              required
            />
          </label>
          <label>
            Chave secreta do cliente
            <input
              autoComplete="new-password"
              name="clientSecret"
              required
              type="password"
            />
          </label>
          <button disabled={saving} type="submit">
            {saving ? "Protegendo..." : "Salvar credenciais com segurança"}
          </button>
        </form>
      ) : null}

      {status?.configured && !status.connected ? (
        <a className="google-calendar-connect" href="/api/integrations/google-calendar/connect">
          Autorizar conta Google
        </a>
      ) : null}

      {status?.connected ? (
        <button
          className="google-calendar-sync"
          disabled={saving}
          onClick={sync}
          type="button"
        >
          {saving ? "Sincronizando..." : "Sincronizar agora"}
        </button>
      ) : null}
      {message ? <p className="google-calendar-message" role="status">{message}</p> : null}
    </div>
  );
}
