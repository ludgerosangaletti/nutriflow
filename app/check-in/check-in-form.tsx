"use client";

import { useRouter } from "next/navigation";
import { CheckinFlow } from "./CheckinFlow";
import { buildCheckInFormData, type CheckInAnswer } from "./check-in-model";

export default function CheckInForm({ nutritionistName }: Readonly<{ nutritionistName: string }>) {
  const router = useRouter();
  async function submit(answers: Readonly<Record<string, CheckInAnswer>>) {
    const body = buildCheckInFormData(answers);
    const response = await fetch("/api/check-in", { method: "POST", body });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Verifique sua conexão e tente novamente.");
  }
  function exit() { router.push("/area-cliente"); router.refresh(); }
  return <CheckinFlow nutritionistName={nutritionistName} onSubmit={submit} onExit={exit} />;
}
