import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { automations } from "@db/schema";
import { createActivity } from "../queries/activities";
import { createTask } from "../queries/tasks";
import { findOrganizationById } from "../queries/organizations";
import { sendSMS } from "./twilio";
import { sendEmail } from "./email";
import { decryptSecret } from "./crypto";

// Trigger values the engine knows how to fire on — every value in the schema's
// trigger enum except "manual", which is handled separately via
// automationRouter.runNow rather than an emitted event.
//
// no_response and follow_up_needed are time-window based, same shape as
// task_due: api/lib/scheduler.ts sweeps for them on the same cadence.
//   - follow_up_needed: a lead still in status new/contacted with no activity
//     for 3+ days (leads.lastActivityAt / createdAt).
//   - no_response: an open conversation whose last customer-visible message
//     was from agent/ai (not the customer) and is 24+ hours old
//     (conversations.lastMessageAt / lastMessageSenderType).
// Both dedup via a *FlaggedAt timestamp column compared against the activity
// timestamp that drives them, rather than a one-shot flag — see the columns'
// comments in db/schema.ts for why that self-resets safely.
export type AutomationTrigger =
  | "lead_created"
  | "lead_status_changed"
  | "conversation_started"
  | "call_completed"
  | "appointment_scheduled"
  | "task_due"
  | "no_response"
  | "follow_up_needed";

// The data an event carries. phone/email are resolved by the caller (from the
// lead/customer the event is about) so action execution stays trigger-agnostic.
export interface AutomationEventPayload {
  leadId?: number | null;
  customerId?: number | null;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  [key: string]: unknown;
}

// The Workflows builder UI (src/pages/Workflows.tsx) never sends `conditions` today —
// every rule saved through it has none. This shape is what the schema/API already
// support and is a reasonable minimal form for a future condition-builder UI; an
// empty/missing list always matches, which is the only case reachable right now.
interface AutomationCondition {
  field: string;
  operator?: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value?: unknown;
}

function evaluateConditions(conditions: unknown, payload: AutomationEventPayload): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return (conditions as AutomationCondition[]).every((cond) => {
    if (!cond || typeof cond !== "object" || !("field" in cond)) return true;
    const actual = payload[cond.field];
    switch (cond.operator ?? "equals") {
      case "equals":
        return String(actual ?? "") === String(cond.value ?? "");
      case "not_equals":
        return String(actual ?? "") !== String(cond.value ?? "");
      case "contains":
        return String(actual ?? "").toLowerCase().includes(String(cond.value ?? "").toLowerCase());
      case "greater_than":
        return Number(actual) > Number(cond.value);
      case "less_than":
        return Number(actual) < Number(cond.value);
      default:
        return true;
    }
  });
}

// Matches the exact shape src/pages/Workflows.tsx's ActionItem produces and saves
// into automations.actions.
interface ActionItem {
  type: "send_sms" | "send_email" | "create_task";
  body?: string;
  subject?: string;
  title?: string;
  daysLater?: number;
}

function fillTemplate(text: string, payload: AutomationEventPayload): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => String(payload[key] ?? ""));
}

async function runAction(
  action: ActionItem,
  organizationId: number,
  payload: AutomationEventPayload,
  triggerLabel: string
): Promise<{ ok: boolean; detail: string }> {
  // Reuses the exact same integration functions the rest of the app calls
  // (conversationRouter, organizationRouter invites, the AI auto-reply) — no
  // second SMS/email implementation.
  if (action.type === "send_sms") {
    if (!payload.phone) return { ok: false, detail: "No phone number available on the triggering record" };
    const org = await findOrganizationById(organizationId);
    const result = await sendSMS(payload.phone, fillTemplate(action.body || "", payload), {
      accountSid: org?.twilioAccountSid,
      authToken: org?.twilioAuthToken ? decryptSecret(org.twilioAuthToken) : null,
      phoneNumber: org?.twilioPhoneNumber,
    });
    if (result.status === "development_not_sent") return { ok: false, detail: "SMS not sent — Twilio is not configured" };
    return { ok: true, detail: `SMS dispatched (sid: ${(result as { sid?: string }).sid ?? "n/a"})` };
  }

  if (action.type === "send_email") {
    if (!payload.email) return { ok: false, detail: "No email address available on the triggering record" };
    const org = await findOrganizationById(organizationId);
    const result = await sendEmail(
      payload.email,
      fillTemplate(action.subject || "Update from LeadFlow AI", payload),
      fillTemplate(action.body || "", payload),
      {
        host: org?.smtpHost,
        port: org?.smtpPort,
        user: org?.smtpUser,
        pass: org?.smtpPass ? decryptSecret(org.smtpPass) : null,
        fromEmail: org?.smtpFromEmail,
      }
    );
    if ("status" in result && result.status === "development_not_sent") {
      return { ok: false, detail: "Email not sent — SMTP is not configured" };
    }
    return { ok: true, detail: `Email dispatched (id: ${(result as { messageId?: string }).messageId ?? "n/a"})` };
  }

  if (action.type === "create_task") {
    // A task_due-triggered rule that creates another task is the one combination
    // that can feed itself: sweepOverdueTasks() only ever fires on a task whose
    // due date has already passed, so a follow-up task due "today" (daysLater 0,
    // or any config that resolves to now-or-earlier) would itself be overdue by
    // the next sweep and refire this same rule — an unbounded cascade of
    // "escalate the escalation" tasks. Floor to at least 1 day out in that one
    // case; every other trigger creates a task from a distinct, non-recurring
    // event and isn't at risk.
    const daysLater = triggerLabel === "task_due" ? Math.max(action.daysLater ?? 0, 1) : action.daysLater ?? 0;
    const dueDate = new Date(Date.now() + daysLater * 24 * 60 * 60 * 1000);
    const task = await createTask({
      organizationId,
      leadId: payload.leadId ?? undefined,
      customerId: payload.customerId ?? undefined,
      title: fillTemplate(action.title || "Follow up", payload),
      type: "follow_up",
      status: "pending",
      priority: "medium",
      dueDate,
    });
    return { ok: !!task, detail: task ? `Task #${task.id} created, due ${dueDate.toISOString()}` : "Failed to create task" };
  }

  return { ok: false, detail: `Unknown action type: ${(action as ActionItem).type}` };
}

// The single entry point every trigger site calls after its DB write succeeds.
// Looks up this org's active automations for the trigger, evaluates conditions,
// runs actions in order, and always records what happened (runCount/lastRunAt +
// an activity log entry) — including partial/total failure, so a blocked action
// (e.g. Twilio trial restrictions) is visible in the org's activity feed rather
// than silently disappearing.
type AutomationRow = typeof automations.$inferSelect;

// Runs one specific automation row unconditionally (still condition-checked) and
// records the outcome. Shared by emitAutomationEvent (which finds the matching
// rows for a trigger) and automationRouter.runNow (which already has one specific
// row picked by id, for manual test-runs — that path intentionally skips the
// trigger/status match since the user explicitly asked to run this exact rule).
async function runSingleAutomation(
  automation: AutomationRow,
  organizationId: number,
  payload: AutomationEventPayload,
  triggerLabel: string
): Promise<void> {
  const db = getDb();
  try {
    if (!evaluateConditions(automation.conditions, payload)) return;

    const actionList = Array.isArray(automation.actions) ? (automation.actions as unknown as ActionItem[]) : [];
    const results: string[] = [];
    let anyFailed = false;

    for (const action of actionList) {
      try {
        const res = await runAction(action, organizationId, payload, triggerLabel);
        results.push(`${action.type}: ${res.detail}`);
        if (!res.ok) anyFailed = true;
      } catch (err) {
        anyFailed = true;
        const message = err instanceof Error ? err.message : String(err);
        results.push(`${action.type}: failed — ${message}`);
        console.error(`[automation] "${automation.name}" (#${automation.id}) action "${action.type}" threw:`, err);
      }
    }

    await db
      .update(automations)
      .set({ runCount: sql`${automations.runCount} + 1`, lastRunAt: new Date() })
      .where(eq(automations.id, automation.id));

    await createActivity({
      organizationId,
      actorType: "system",
      entityType: "automation",
      entityId: automation.id,
      action: anyFailed ? "Automation ran with errors" : "Automation ran",
      description: `"${automation.name}" (${triggerLabel}): ${results.join("; ") || "no actions configured"}`,
    });
  } catch (err) {
    // A single misbehaving rule must never take down the request that triggered
    // it, or block the other automations matched by this same event.
    console.error(`[automation] rule #${automation.id} failed before completing:`, err);
  }
}

export async function emitAutomationEvent(
  trigger: AutomationTrigger,
  organizationId: number,
  payload: AutomationEventPayload
): Promise<void> {
  const db = getDb();
  const matches = await db.query.automations.findMany({
    where: and(
      eq(automations.organizationId, organizationId),
      eq(automations.trigger, trigger),
      eq(automations.status, "active")
    ),
  });

  for (const automation of matches) {
    await runSingleAutomation(automation, organizationId, payload, trigger);
  }
}

// Manual test-run of one specific rule, bypassing trigger/status matching since
// the caller already has the exact row (used by automationRouter.runNow).
export async function runAutomationById(
  automation: AutomationRow,
  payload: AutomationEventPayload
): Promise<void> {
  await runSingleAutomation(automation, automation.organizationId, payload, "manual");
}
