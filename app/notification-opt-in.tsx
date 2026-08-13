"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "disabled" | "intro" | "subscribing" | "subscribed" | "unsubscribing" | "denied" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function NotificationOptIn() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setStatus("denied");
        return;
      }
      try {
        const subscription = await currentSubscription();
        if (active) setStatus(subscription ? "subscribed" : "disabled");
      } catch {
        if (active) setStatus("error");
      }
    }
    void inspect();
    return () => { active = false; };
  }, []);

  async function handleSubscribe() {
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID_NOT_CONFIGURED");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("SUBSCRIPTION_SAVE_FAILED");
      setStatus("subscribed");
    } catch (error) {
      console.error("NF_PUSH_SUBSCRIBE_FAILED", error instanceof Error ? error.message : "unknown");
      setStatus("error");
    }
  }

  async function handleUnsubscribe() {
    setStatus("unsubscribing");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("SUBSCRIPTION_REMOVE_FAILED");
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } catch (error) {
      console.error("NF_PUSH_UNSUBSCRIBE_FAILED", error instanceof Error ? error.message : "unknown");
      setStatus("error");
    }
  }

  const enabled = status === "subscribed" || status === "unsubscribing";
  const busy = status === "checking" || status === "subscribing" || status === "unsubscribing";

  return (
    <section className="nf-notification-settings" aria-labelledby="notification-settings-title">
      <div className="nf-notification-settings__copy">
        <span className={`nf-notification-settings__status ${enabled ? "is-enabled" : ""}`} aria-hidden="true" />
        <div>
          <p className="nf-eyebrow">Preferências</p>
          <h3 id="notification-settings-title">Notificações deste dispositivo</h3>
          <p aria-live="polite">
            {status === "checking" ? "Verificando a configuração deste aparelho…" : null}
            {status === "subscribed" ? "Ativadas. Você poderá receber avisos importantes do acompanhamento." : null}
            {status === "unsubscribing" ? "Desativando notificações…" : null}
            {status === "subscribing" ? "Ativando notificações…" : null}
            {status === "disabled" || status === "intro" ? "Desativadas neste aparelho. A preferência pode ser alterada quando quiser." : null}
            {status === "denied" ? "Bloqueadas pelo navegador. Libere as notificações nas configurações do site ou do celular e volte aqui." : null}
            {status === "unsupported" ? "Este navegador não oferece notificações. No iPhone, instale o NutriFlow na Tela de Início e abra pelo ícone." : null}
            {status === "error" ? "Não foi possível atualizar agora. Tente novamente." : null}
          </p>
        </div>
      </div>

      {status === "intro" ? (
        <div className="nf-notification-settings__confirm">
          <p>O celular solicitará sua permissão. O NutriFlow enviará apenas avisos relacionados ao seu acompanhamento.</p>
          <div>
            <button type="button" className="nf-notification-settings__secondary" onClick={() => setStatus("disabled")}>Agora não</button>
            <button type="button" className="nf-notification-settings__primary" onClick={handleSubscribe}>Continuar</button>
          </div>
        </div>
      ) : null}

      {status === "disabled" || status === "error" ? <button type="button" className="nf-notification-settings__primary" onClick={() => setStatus("intro")}>Ativar notificações</button> : null}
      {status === "subscribed" ? <button type="button" className="nf-notification-settings__secondary" onClick={handleUnsubscribe}>Desativar</button> : null}
      {busy ? <button type="button" className="nf-notification-settings__secondary" disabled>{status === "unsubscribing" ? "Desativando…" : status === "subscribing" ? "Ativando…" : "Verificando…"}</button> : null}
    </section>
  );
}
