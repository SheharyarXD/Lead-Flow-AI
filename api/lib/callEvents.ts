import { eq, and, ne } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { customers, leads, calls } from "@db/schema";
import { recordCallMinutesUsed } from "./billing";
import { emitAutomationEvent } from "./automations";

// Single place every "a call just completed" code path calls — the generic
// Twilio status webhook, the <Record action> voicemail-completion webhook,
// and the manual-hangup fallback (callRouter.hangup) all funnel through here.
//
// It owns the atomic claim (flipping status to "completed"), not just the
// side effects: a single inbound call can legitimately reach this function
// from more than one of those three call sites — e.g. an account/number-level
// Twilio status callback (unverifiable from this codebase whether it's even
// configured) firing for the same call the <Record action> callback already
// finalized. Doing the status flip here, gated on the row not already being
// "completed", means only the caller that actually wins the race records
// minutes or fires call_completed automations — callers must NOT set status
// to "completed" themselves before calling this.
export async function onCallCompleted(
  organizationId: number,
  callId: number,
  leadId: number | null,
  customerId: number | null,
  phoneNumber: string,
  direction: "inbound" | "outbound",
  durationSeconds: number
): Promise<boolean> {
  const db = getDb();

  const [result] = await db
    .update(calls)
    .set({ status: "completed", endedAt: new Date() })
    .where(and(eq(calls.id, callId), eq(calls.organizationId, organizationId), ne(calls.status, "completed")));
  if (result.affectedRows === 0) return false;

  await recordCallMinutesUsed(organizationId, durationSeconds);

  const customer = customerId ? await db.query.customers.findFirst({ where: eq(customers.id, customerId) }) : null;
  const lead = leadId ? await db.query.leads.findFirst({ where: eq(leads.id, leadId) }) : null;

  await emitAutomationEvent("call_completed", organizationId, {
    callId,
    leadId: leadId ?? null,
    customerId: customerId ?? null,
    phone: customer?.phone ?? lead?.phone ?? phoneNumber ?? null,
    email: customer?.email ?? lead?.email ?? null,
    firstName: customer?.firstName ?? lead?.firstName ?? null,
    lastName: customer?.lastName ?? lead?.lastName ?? null,
    direction,
    duration: durationSeconds,
  });

  return true;
}
