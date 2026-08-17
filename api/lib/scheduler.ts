import cron from "node-cron";
import { eq, and, or, isNull, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { tasks, customers, leads, conversations } from "@db/schema";
import { emitAutomationEvent } from "./automations";

// task_due, follow_up_needed, and no_response are the three automation
// triggers that aren't fired by a DB write — they're all "a point in time
// arrived" conditions, so they need a periodic sweep rather than an event
// hook. No queue/cron library existed in this project before (no Redis
// either), so node-cron was added: it's in-process and dependency-free,
// which fits an app that already runs as a single Node process (api/boot.ts)
// with no worker/queue infra. If this ever needs to run across multiple
// instances, a real job queue (e.g. BullMQ, which needs Redis) would be the
// next step — not needed today.
//
// Every "is this stale/overdue yet" comparison below is done entirely in
// SQL (NOW(), DATE_SUB(...)) rather than binding a JS-computed Date as a
// threshold. Found while testing no_response: this MySQL server's session
// timezone is "SYSTEM" (not UTC — it's ~5 hours off real UTC on this
// machine), and mysql2 doesn't convert TIMESTAMP values on read, so a
// JS `Date.now()` compared against a DB column can be off by that same
// margin. task_due never surfaced this because task due-dates in practice
// carry multi-day margins that swallow a few hours of skew; a tight 24-hour
// no_response window did not. Keeping every comparison inside MySQL's own
// clock avoids the cross-domain skew entirely, regardless of the
// server/driver timezone configuration — a real fix for this specific
// scheduler, not a workaround. The underlying mysql2 timezone-conversion
// setting is a separate, wider-reaching concern (it could affect any other
// tight time comparison in the app) worth a deliberate look on its own.
const FOLLOW_UP_THRESHOLD_SQL = sql`DATE_SUB(NOW(), INTERVAL 3 DAY)`; // 3 days of no activity
const NO_RESPONSE_THRESHOLD_SQL = sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`; // 24 hours since our last message

// Vite's dev server can re-evaluate this module on HMR; a plain module-level
// flag would reset on each re-evaluation and stack up duplicate cron jobs.
// globalThis survives across re-evaluations within the same process, so it's
// used as the guard instead.
declare global {
  // eslint-disable-next-line no-var
  var __leadflowSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (globalThis.__leadflowSchedulerStarted) return;
  globalThis.__leadflowSchedulerStarted = true;

  cron.schedule("*/5 * * * *", () => {
    sweepOverdueTasks().catch((err) => console.error("[scheduler] task_due sweep failed:", err));
    sweepStaleLeads().catch((err) => console.error("[scheduler] follow_up_needed sweep failed:", err));
    sweepUnansweredConversations().catch((err) => console.error("[scheduler] no_response sweep failed:", err));
  });
}

// Exported directly so it can be triggered on demand (tests, manual runs)
// without waiting for the next 5-minute tick.
export async function sweepOverdueTasks(): Promise<number> {
  const db = getDb();

  const due = await db.query.tasks.findMany({
    where: and(inArray(tasks.status, ["pending", "in_progress"]), isNotNull(tasks.dueDate), sql`${tasks.dueDate} <= NOW()`),
  });

  let claimed = 0;
  for (const task of due) {
    // Claim the row before doing anything else: the status flip only "counts"
    // if THIS call is the one that actually moved it out of pending/in_progress.
    // Two sweeps can overlap in practice — a manual run landing on the same
    // 5-minute cron boundary, or (once this runs on more than one instance) two
    // processes ticking at once — and without this, both would still see the
    // same row as a plain SELECT result and both fire the automation on it.
    const [result] = await db
      .update(tasks)
      .set({ status: "overdue" })
      .where(and(eq(tasks.id, task.id), inArray(tasks.status, ["pending", "in_progress"])));
    if (result.affectedRows === 0) continue;
    claimed++;

    const customer = task.customerId
      ? await db.query.customers.findFirst({ where: eq(customers.id, task.customerId) })
      : null;
    const lead = task.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, task.leadId) }) : null;

    await emitAutomationEvent("task_due", task.organizationId, {
      taskId: task.id,
      leadId: task.leadId ?? null,
      customerId: task.customerId ?? null,
      phone: customer?.phone ?? lead?.phone ?? null,
      email: customer?.email ?? lead?.email ?? null,
      firstName: customer?.firstName ?? lead?.firstName ?? null,
      lastName: customer?.lastName ?? lead?.lastName ?? null,
      title: task.title,
      dueDate: task.dueDate,
    });
  }

  return claimed;
}

// A lead still sitting in new/contacted with no activity in 3+ days. Dedup is
// a comparison, not a one-shot flag: only fires when followUpFlaggedAt is
// unset OR lastActivityAt has moved past it — so a lead that gets touched
// (resetting lastActivityAt via any of the routers that call it) and then
// goes stale again is eligible to fire again, with no separate "clear the
// flag" call needed anywhere.
export async function sweepStaleLeads(): Promise<number> {
  const db = getDb();
  const staleCondition = sql`COALESCE(${leads.lastActivityAt}, ${leads.createdAt}) <= ${FOLLOW_UP_THRESHOLD_SQL}`;
  const notYetFlagged = or(isNull(leads.followUpFlaggedAt), sql`${leads.lastActivityAt} > ${leads.followUpFlaggedAt}`);

  const candidates = await db.query.leads.findMany({
    where: and(inArray(leads.status, ["new", "contacted"]), staleCondition, notYetFlagged),
  });

  let claimed = 0;
  for (const lead of candidates) {
    const [result] = await db
      .update(leads)
      .set({ followUpFlaggedAt: sql`NOW()` })
      .where(and(eq(leads.id, lead.id), notYetFlagged));
    if (result.affectedRows === 0) continue;
    claimed++;

    const customer = lead.customerId
      ? await db.query.customers.findFirst({ where: eq(customers.id, lead.customerId) })
      : null;

    await emitAutomationEvent("follow_up_needed", lead.organizationId, {
      leadId: lead.id,
      customerId: lead.customerId ?? null,
      phone: lead.phone ?? customer?.phone ?? null,
      email: lead.email ?? customer?.email ?? null,
      firstName: lead.firstName,
      lastName: lead.lastName,
      status: lead.status,
      lastActivityAt: lead.lastActivityAt ?? lead.createdAt,
    });
  }

  return claimed;
}

// An open conversation whose last customer-visible message was ours
// (agent/ai) and is 24+ hours old — i.e. we're waiting on the customer and
// they've gone quiet. Same self-resetting dedup approach as sweepStaleLeads,
// against lastMessageAt: any new message (in either direction) naturally
// re-arms it for next time.
export async function sweepUnansweredConversations(): Promise<number> {
  const db = getDb();
  const notYetFlagged = or(
    isNull(conversations.noResponseFlaggedAt),
    sql`${conversations.lastMessageAt} > ${conversations.noResponseFlaggedAt}`
  );

  const candidates = await db.query.conversations.findMany({
    where: and(
      eq(conversations.status, "open"),
      inArray(conversations.lastMessageSenderType, ["agent", "ai"]),
      isNotNull(conversations.lastMessageAt),
      sql`${conversations.lastMessageAt} <= ${NO_RESPONSE_THRESHOLD_SQL}`,
      notYetFlagged
    ),
  });

  let claimed = 0;
  for (const conv of candidates) {
    const [result] = await db
      .update(conversations)
      .set({ noResponseFlaggedAt: sql`NOW()` })
      .where(and(eq(conversations.id, conv.id), notYetFlagged));
    if (result.affectedRows === 0) continue;
    claimed++;

    const customer = conv.customerId
      ? await db.query.customers.findFirst({ where: eq(customers.id, conv.customerId) })
      : null;
    const lead = conv.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, conv.leadId) }) : null;

    await emitAutomationEvent("no_response", conv.organizationId, {
      conversationId: conv.id,
      leadId: conv.leadId ?? null,
      customerId: conv.customerId ?? null,
      channel: conv.channel,
      phone: customer?.phone ?? lead?.phone ?? null,
      email: customer?.email ?? lead?.email ?? null,
      firstName: customer?.firstName ?? lead?.firstName ?? null,
      lastName: customer?.lastName ?? lead?.lastName ?? null,
      lastMessageAt: conv.lastMessageAt,
    });
  }

  return claimed;
}
