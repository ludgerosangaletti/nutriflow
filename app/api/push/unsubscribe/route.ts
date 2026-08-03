import { getPatientUser } from "../../../supabase/server";
import { removeSubscription } from "../../../../lib/push/push-subscriptions-repo";
export async function POST(request: Request) { const user = await getPatientUser(); if (!user?.email) return Response.json({ error: "unauthorized" }, { status: 401 }); const body = await request.json() as { endpoint?: string }; if (!body.endpoint) return Response.json({ error: "invalid_subscription" }, { status: 400 }); await removeSubscription(body.endpoint); return Response.json({ ok: true }); }
