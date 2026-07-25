"use client";

import { useEffect, useState } from "react";

function remaining(expiresAt: string) {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default function AccessCountdown({
  startedAt,
  expiresAt,
}: {
  startedAt: string;
  expiresAt: string;
}) {
  const [days, setDays] = useState(() => remaining(expiresAt));

  useEffect(() => {
    const timer = window.setInterval(
      () => setDays(remaining(expiresAt)),
      60 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const total = Math.max(
    1,
    Math.ceil(
      (new Date(expiresAt).getTime() - new Date(startedAt).getTime()) /
        86_400_000,
    ),
  );
  const percent = Math.max(0, Math.min(100, (days / total) * 100));

  return (
    <article className="access-countdown">
      <div>
        <span>Vigência da assessoria</span>
        <strong>{days}</strong>
        <b>{days === 1 ? "dia restante" : "dias restantes"}</b>
      </div>
      <div className="access-countdown-detail">
        <p>Seu acesso permanece ativo até <strong>{formatDate(expiresAt)}</strong>.</p>
        <div aria-label={`${days} dias restantes`} className="access-progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <small>
          A contagem começou na confirmação do pagamento, em {formatDate(startedAt)}.
        </small>
      </div>
    </article>
  );
}
