"use client";

import { useState } from "react";

export default function LeadDeleteButton({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    if (
      !window.confirm(
        `Excluir o lead ${label}? Esta ação remove o contato da base comercial.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível excluir o lead.");
      }
      setMessage("Lead excluído.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o lead.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="lead-delete-control">
      <button disabled={deleting} onClick={remove} type="button">
        {deleting ? "Excluindo..." : "Excluir"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
