import type { InferSelectModel } from "drizzle-orm";
import type { clients } from "../db/schema";
import { isPlanId, type PlanId } from "./plans";

type Client = InferSelectModel<typeof clients>;

const planMonths: Record<PlanId, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
};

export function calculateAccessPeriod(plan: string, start = new Date()) {
  const months = isPlanId(plan) ? planMonths[plan] : 1;
  const expires = new Date(start);
  expires.setUTCMonth(expires.getUTCMonth() + months);
  return {
    startedAt: start.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export function hasActiveAccess(
  client: Pick<Client, "paymentStatus" | "accessExpiresAt">,
  now = new Date(),
) {
  return (
    client.paymentStatus === "approved" &&
    Boolean(client.accessExpiresAt) &&
    new Date(client.accessExpiresAt!).getTime() > now.getTime()
  );
}

export function daysRemaining(expiresAt?: string | null, now = new Date()) {
  if (!expiresAt) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000),
  );
}
