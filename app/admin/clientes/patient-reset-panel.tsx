"use client";

import { useMemo, useState } from "react";

type Patient = {
  email: string;
  name: string;
  modality: string;
};

export default function PatientResetPanel({ patients }: { patients: Patient[] }) {
  const [selectedEmail, setSelectedEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.email === selectedEmail),
    [patients, selectedEmail],
  );
  const confirmed =
    Boolean(selectedEmail) &&
    confirmation.trim().toLowerCase() === selectedEmail.toLowerCase();

  async function resetPatient() {
    if (!selectedPatient || !confirmed || saving) return;
    if (
      !window.confirm(
        `Excluir definitivamente o cadastro e todos os dados de ${selectedPatient.email}? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pacientes/reset", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: selectedPatient.email,
          confirmation,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        clinicalHistoryPreserved?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível excluir o cadastro.");
      }
      setMessage(result.clinicalHistoryPreserved
        ? "Reset concluído. O histórico clínico publicado foi preservado de forma desidentificada e o paciente poderá ser cadastrado novamente do zero."
        : "Reset concluído. A conta e os dados do paciente foram excluídos; um novo cadastro começará do zero.");
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o cadastro.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="admin-patient-reset">
      <summary>
        <div>
          <span>Área de segurança</span>
          <strong>Excluir cadastro e reiniciar paciente</strong>
        </div>
        <i aria-hidden="true">⌄</i>
      </summary>
      <div className="admin-patient-reset-body">
        <div>
          <h3>Reset completo do paciente</h3>
          <p>
            Remove conta, confirmação de e-mail, dados cadastrais, anamnese,
            check-ins, fotos, documentos, metas, lembretes e solicitações. Para
            voltar, o paciente precisará receber um novo convite e criar a conta
            novamente. Versões clínicas já publicadas permanecem preservadas de
            forma desidentificada para manter a auditoria obrigatória.
          </p>
        </div>
        <label>
          Paciente
          <select
            onChange={(event) => {
              setSelectedEmail(event.target.value);
              setConfirmation("");
              setMessage("");
            }}
            value={selectedEmail}
          >
            <option value="">Selecione um cadastro</option>
            {patients.map((patient) => (
              <option key={patient.email} value={patient.email}>
                {patient.name} · {patient.email} ·{" "}
                {patient.modality === "in_person" ? "Presencial" : "Online"}
              </option>
            ))}
          </select>
        </label>
        {selectedPatient ? (
          <label>
            Digite o e-mail para confirmar
            <input
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={selectedPatient.email}
              spellCheck={false}
              value={confirmation}
            />
          </label>
        ) : null}
        <button
          className="admin-reset-button"
          disabled={!confirmed || saving}
          onClick={resetPatient}
          type="button"
        >
          {saving ? "Excluindo cadastro..." : "Excluir e reiniciar paciente"}
        </button>
        {message ? <p role="status">{message}</p> : null}
      </div>
    </details>
  );
}
