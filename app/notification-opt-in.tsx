"use client";

import { useEffect, useState } from "react";

type Status =
  | "idle"
  | "unsupported"
  | "intro"
  | "subscribing"
  | "subscribed"
  | "denied"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Opt-in de notificações push do paciente.
 *
 * v3: cores e raios trocados pelos valores REAIS do site (extraídos ao vivo
 * de ludgerosangaletti.com.br, ver docs/IDENTIDADE_VISUAL_REAL.md do
 * Experience Pack) — creme #f5f5f2, preto #0a0a0a, lime #ffea00, radius 24px
 * nos cards e 10px nos botões, igual ao CTA real da home. O botão "Ativar"
 * usa texto preto sobre lime (nunca branco — o site real nunca usa lime com
 * texto claro em cima).
 *
 * v2 (mantida): a permissão nativa do navegador nunca é pedida no primeiro
 * toque. Primeiro mostramos contexto curto ("por que" e "para quê"), e só
 * então o botão "Ativar" dispara Notification.requestPermission() — a
 * permissão de notificação é um recurso escasso, se negada sem contexto o
 * navegador não deixa pedir de novo.
 */
export function NotificationOptIn() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") setStatus("denied");
    if (Notification.permission === "granted") setStatus("subscribed");
  }, []);

  async function handleSubscribe() {
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada.");
        setStatus("error");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) throw new Error("Falha ao salvar inscrição");
      setStatus("subscribed");
    } catch (error) {
      console.error("Erro ao ativar notificações:", error);
      setStatus("error");
    }
  }

  if (status === "unsupported") return null;

  if (status === "subscribed") {
    return (
      <p className="text-sm text-[#242424]">
        Notificações ativadas neste dispositivo.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-[#242424]">
        As notificações estão bloqueadas para este site no seu navegador. Para
        ativar, libere a permissão de notificações nas configurações do
        navegador.
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-[#242424]">
          Não foi possível ativar as notificações agora.
        </p>
        <button
          type="button"
          onClick={() => setStatus("intro")}
          className="text-sm font-medium underline underline-offset-2 text-[#0a0a0a]"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (status === "intro" || status === "subscribing") {
    return (
      <div className="rounded-[24px] border border-black/[0.14] bg-[#f5f5f2] p-4">
        <p className="text-sm font-bold text-[#0a0a0a]">
          Receber avisos do seu nutricionista
        </p>
        <p className="mt-1 text-sm text-[#242424]">
          Ative para ser avisado quando um novo plano for publicado ou sua
          consulta estiver próxima — mesmo com o site fechado.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-[10px] px-3 py-2 text-sm text-[#242424]"
            disabled={status === "subscribing"}
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={status === "subscribing"}
            className="rounded-[10px] bg-[#ffea00] px-3 py-2 text-sm font-bold text-[#0a0a0a] disabled:opacity-60"
          >
            {status === "subscribing" ? "Ativando..." : "Ativar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStatus("intro")}
      className="rounded-[10px] border border-black/[0.14] px-3 py-2 text-sm font-medium text-[#0a0a0a]"
    >
      Ativar notificações
    </button>
  );
}
