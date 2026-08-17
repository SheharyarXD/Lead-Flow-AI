import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// ── Inbound Webhooks for SMS, Email & Voice ──
import { getDb } from "./queries/connection";
import { customers, conversations, activities, organizations, subscriptions, calls, leads, stripeEvents, documents } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { createMessage } from "./queries/conversations";
import { findCallByTwilioSid, findCallById, createCall, updateCall } from "./queries/calls";
import { createTask } from "./queries/tasks";
import { requireOrganizationMembership as requireCallOrgMembership } from "./queries/organizations";
import { triggerAIAutoReply } from "./lib/ai-agent";
import { decryptSecret } from "./lib/crypto";
import { authenticateRequest } from "./kimi/auth";
import { onCallCompleted } from "./lib/callEvents";
import { startScheduler } from "./lib/scheduler";
import { MAX_UPLOAD_BYTES, isAllowedUploadMimeType } from "./lib/uploads";
import { saveLocalFile, readLocalFile } from "./lib/localStorage";
import twilio from "twilio";
import { timingSafeEqual } from "crypto";

startScheduler();

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Shared by every Twilio Voice webhook: resolves the tenant by the number the
// call came in on (or went out from), then validates the request signature
// using THAT organization's own Twilio auth token when they've configured
// their own account (BYOK), falling back to the platform-wide token otherwise.
// A webhook can never be trusted to say which organization it's for on its
// own — the "To"/"From" number is the only thing we verify tenancy from.
async function resolveVoiceOrgAndVerify(
  c: { req: { header: (n: string) => string | undefined; url: string } },
  body: Record<string, unknown>,
  lookupNumber: string
) {
  const db = getDb();
  let organization = lookupNumber
    ? await db.query.organizations.findFirst({ where: eq(organizations.phone, lookupNumber) })
    : null;
  if (!organization && !env.isProduction) {
    organization = await db.query.organizations.findFirst();
  }

  const signature = c.req.header("x-twilio-signature");
  const orgToken = organization?.twilioAuthToken ? decryptSecret(organization.twilioAuthToken) : null;
  const tokenToVerifyWith = orgToken || process.env.TWILIO_AUTH_TOKEN;

  if (env.isProduction) {
    const params = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]));
    if (!tokenToVerifyWith || !signature || !twilio.validateRequest(tokenToVerifyWith, signature, c.req.url, params)) {
      return { organization: null, valid: false as const };
    }
  }
  return { organization, valid: true as const };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mapTwilioCallStatus(status: string): typeof calls.$inferSelect.status {
  switch (status) {
    case "in-progress":
      return "in_progress";
    case "no-answer":
      return "no_answer";
    case "queued":
    case "ringing":
    case "completed":
    case "busy":
    case "failed":
    case "canceled":
      return status;
    default:
      return "queued";
  }
}

app.post("/api/webhooks/sms", async (c) => {
  const db = getDb();
  const body = await c.req.parseBody();
  const signature = c.req.header("x-twilio-signature");
  const webhookToken = process.env.TWILIO_AUTH_TOKEN;
  if (env.isProduction && (!webhookToken || !signature || !twilio.validateRequest(webhookToken, signature, c.req.url, Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)]))))) return c.text("Unauthorized", 401);
  
  const fromNum = (body.From as string) || "";
  const toNum = (body.To as string) || "";
  const textBody = (body.Body as string) || "";
  
  if (!fromNum || !textBody) {
    c.header("Content-Type", "application/xml");
    return c.text("<Response></Response>");
  }

  try {
    let organization = toNum ? await db.query.organizations.findFirst({ where: eq(organizations.phone, toNum) }) : null;
    if (!organization && !env.isProduction) {
      organization = await db.query.organizations.findFirst();
    }
    if (!organization) return c.text("<Response></Response>", 404, { "Content-Type": "application/xml" });
    let customer = await db.query.customers.findFirst({
      where: and(eq(customers.phone, fromNum), eq(customers.organizationId, organization.id)),
    });

    if (!customer) {
      const [custResult] = await db.insert(customers).values({
        organizationId: organization.id,
        firstName: "Inbound",
        lastName: fromNum,
        phone: fromNum,
        source: "sms",
        status: "active",
      }).$returningId();

      customer = await db.query.customers.findFirst({
        where: eq(customers.id, custResult.id),
      });
    }

    if (customer) {
      let conv = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.customerId, customer.id),
          eq(conversations.organizationId, organization.id),
          eq(conversations.channel, "sms"),
          eq(conversations.status, "open")
        ),
      });

      if (!conv) {
        const [convResult] = await db.insert(conversations).values({
          organizationId: organization.id,
          customerId: customer.id,
          channel: "sms",
          subject: `SMS Thread with ${customer.firstName} ${customer.lastName}`,
          status: "open",
          priority: "medium",
          messageCount: 0,
          unreadCount: 1,
          aiHandled: true,
        }).$returningId();
        
        conv = await db.query.conversations.findFirst({
          where: eq(conversations.id, convResult.id),
        });
      } else {
        await db.update(conversations)
          .set({
            unreadCount: (conv.unreadCount ?? 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conv.id));
      }

      if (conv) {
        await createMessage({
          conversationId: conv.id,
          senderType: "customer",
          content: textBody,
        });

        await db.insert(activities).values({
          organizationId: organization.id,
          actorType: "customer",
          entityType: "conversation",
          entityId: conv.id,
          action: "Received SMS",
          description: `SMS from ${customer.firstName}: "${textBody.slice(0, 50)}"`,
        });

        if (conv.aiHandled) {
          triggerAIAutoReply(conv.id, textBody).catch(err => {
            console.error("AI Auto-responder error:", err);
          });
        }
      }
    }
  } catch (error) {
    console.error("Error processing inbound SMS webhook:", error);
  }

  c.header("Content-Type", "application/xml");
  return c.text("<Response></Response>");
});

// ── Voice Webhook — TwiML instructions ──
// Hit for two distinct cases, distinguished by whether our own custom
// "callRecordId" param is present:
//  1. The agent's browser placed an outbound call via the Twilio Voice SDK
//     (Device.connect()). We already created the call row up front in
//     initiateCall and passed its id through as a custom param — this is the
//     only reliable way to correlate the leg Twilio is about to create with
//     our record, since the real CallSid doesn't exist until now.
//  2. A genuine inbound call from a customer dialing the organization's
//     configured number.
app.post("/api/webhooks/voice", async (c) => {
  const db = getDb();
  const body = await c.req.parseBody();
  const fromNum = (body.From as string) || "";
  const toNum = (body.To as string) || "";
  const callSid = (body.CallSid as string) || "";
  const callRecordId = (body.callRecordId as string) || "";

  c.header("Content-Type", "application/xml");

  // ── Case 1: outbound call placed from the agent's browser ──
  if (callRecordId) {
    const existingCall = await db.query.calls.findFirst({ where: eq(calls.id, parseInt(callRecordId)) });
    const organization = existingCall
      ? await db.query.organizations.findFirst({ where: eq(organizations.id, existingCall.organizationId) })
      : null;

    const { valid } = await resolveVoiceOrgAndVerify(c, body, organization?.phone || "");
    if (!valid || !existingCall || !organization) {
      return c.text(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject /></Response>`, existingCall ? 200 : 401);
    }

    const targetNumber = (body.To as string) || ""; // custom param we pass from Device.connect()
    if (!targetNumber) {
      return c.text(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">No destination number was provided.</Say></Response>`);
    }

    await updateCall(existingCall.id, existingCall.organizationId, {
      twilioCallSid: callSid || existingCall.twilioCallSid,
      status: "ringing",
    });

    const hostUrl = process.env.PUBLIC_URL || "http://localhost:3000";
    const callerId = organization.twilioPhoneNumber || organization.phone || "";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="${escapeXml(callerId)}" record="record-from-answer" recordingStatusCallback="${hostUrl}/api/webhooks/voice/recording" statusCallback="${hostUrl}/api/webhooks/voice/status" statusCallbackEvent="initiated ringing answered completed">${escapeXml(targetNumber)}</Dial>
</Response>`;
    return c.text(twiml);
  }

  // ── Case 2: genuine inbound call ──
  const { organization, valid } = await resolveVoiceOrgAndVerify(c, body, toNum);
  if (!valid) return c.text("Unauthorized", 401);
  if (!organization) {
    return c.text(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">We're sorry, this number is not currently in service.</Say></Response>`, 404);
  }

  try {
    let customer = fromNum
      ? await db.query.customers.findFirst({ where: and(eq(customers.phone, fromNum), eq(customers.organizationId, organization.id)) })
      : null;

    if (!customer && fromNum) {
      const [custResult] = await db.insert(customers).values({
        organizationId: organization.id,
        firstName: "Inbound",
        lastName: fromNum,
        phone: fromNum,
        source: "phone",
        status: "active",
      }).$returningId();
      customer = await db.query.customers.findFirst({ where: eq(customers.id, custResult.id) });
    }

    const lead = customer
      ? await db.query.leads.findFirst({ where: and(eq(leads.customerId, customer.id), eq(leads.organizationId, organization.id)) })
      : null;

    const newCall = await createCall({
      organizationId: organization.id,
      customerId: customer?.id,
      leadId: lead?.id,
      phoneNumber: fromNum || "Unknown",
      direction: "inbound",
      status: "ringing",
      twilioCallSid: callSid || null,
      startedAt: new Date(),
    });

    if (newCall) {
      await db.insert(activities).values({
        organizationId: organization.id,
        actorType: "customer",
        entityType: "call",
        entityId: newCall.id,
        action: "Inbound call received",
        description: `Call from ${fromNum || "an unknown number"}`,
      });
    }
  } catch (error) {
    console.error("Error recording inbound voice call:", error);
  }

  // By design, not a gap: this SOW scopes "Calling/VoIP integration" and
  // "Call logs & recordings" — there's no line item for bridging an inbound
  // call to a live staff line, and the product is an AI receptionist, not a
  // PBX. Building real call transfer (ringing a staff member's phone/browser,
  // handling no-answer, etc.) would be new scope, not a fix. What this does
  // guarantee instead: every voicemail becomes a logged, recorded call AND an
  // actionable callback task for staff — see the `action` callback below.
  const hostUrl = process.env.PUBLIC_URL || "http://localhost:3000";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling${organization.name ? ` ${escapeXml(organization.name)}` : ""}. Our AI receptionist is taking your call, please leave a message after the tone.</Say>
    <Record maxLength="120" finishOnKey="#" recordingStatusCallback="${hostUrl}/api/webhooks/voice/recording" action="${hostUrl}/api/webhooks/voice/recording-complete" />
</Response>`;
  return c.text(twiml);
});

// ── Inbound Voicemail Completion ──
// Fired synchronously by Twilio as a direct consequence of the <Record
// action="..."> above — guaranteed to happen, unlike relying solely on the
// account/number-level "call status changed" webhook configured in the
// Twilio Console (which this codebase has no way to verify is actually set
// up). Without this, an inbound voicemail call had no deterministic path to
// ever reach status "completed", which meant call_completed automations and
// minute-usage tracking (onCallCompleted) never fired for inbound calls at
// all — only outbound ones. This closes that gap, and also guarantees a
// callback task gets created so a voicemail is never just a recording nobody
// follows up on.
app.post("/api/webhooks/voice/recording-complete", async (c) => {
  const body = await c.req.parseBody();
  const callSid = (body.CallSid as string) || "";
  const recordingUrl = (body.RecordingUrl as string) || "";
  const recordingSid = (body.RecordingSid as string) || "";
  const recordingDuration = parseInt((body.RecordingDuration as string) || "0", 10);
  const callDuration = parseInt((body.CallDuration as string) || `${recordingDuration}`, 10);

  if (!callSid) return c.text('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');

  const existingCall = await findCallByTwilioSid(callSid);
  if (!existingCall) return c.text('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');

  const org = await getDb().query.organizations.findFirst({ where: eq(organizations.id, existingCall.organizationId) });
  const { valid } = await resolveVoiceOrgAndVerify(c, body, org?.phone || "");
  if (!valid) return c.text("Unauthorized", 401);

  // Recording-specific fields are safe to write unconditionally (idempotent
  // even if another call site already finalized this call) — status is not,
  // so that's left entirely to onCallCompleted's atomic claim below.
  await updateCall(existingCall.id, existingCall.organizationId, {
    recordingUrl: recordingUrl || existingCall.recordingUrl || undefined,
    recordingSid: recordingSid || existingCall.recordingSid || undefined,
    recordingDuration: recordingDuration || existingCall.recordingDuration || undefined,
    transcriptStatus: recordingUrl ? "pending" : existingCall.transcriptStatus,
  });

  const won = await onCallCompleted(
    existingCall.organizationId,
    existingCall.id,
    existingCall.leadId,
    existingCall.customerId,
    existingCall.phoneNumber,
    existingCall.direction,
    callDuration
  );

  if (won) {
    await getDb().insert(activities).values({
      organizationId: existingCall.organizationId,
      actorType: "system",
      entityType: "call",
      entityId: existingCall.id,
      action: "Call completed",
      description: recordingDuration > 0
        ? `Voicemail left, ${Math.floor(recordingDuration / 60)}m ${recordingDuration % 60}s`
        : "Caller hung up without leaving a message",
    });

    // A real message was left — make sure it actually gets followed up on,
    // independent of whether this org has configured a call_completed
    // automation. A missed call nobody hears back from is a lost lead.
    if (recordingDuration > 0) {
      await createTask({
        organizationId: existingCall.organizationId,
        customerId: existingCall.customerId,
        leadId: existingCall.leadId,
        title: `Return call — voicemail from ${existingCall.phoneNumber}`,
        description: "Caller left a voicemail. Recording is attached to this call.",
        type: "call",
        status: "pending",
        priority: "high",
        dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    }
  }

  return c.text('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
});

// ── Voice Call Status Webhook ──
app.post("/api/webhooks/voice/status", async (c) => {
  const body = await c.req.parseBody();
  const callSid = (body.CallSid as string) || "";
  const callStatus = (body.CallStatus as string) || "";
  const duration = parseInt((body.CallDuration as string) || "0", 10);

  if (!callSid) return c.text("OK");

  const existingCall = await findCallByTwilioSid(callSid);
  if (!existingCall) {
    // Nothing to correlate this to (e.g. a leg we don't track) — acknowledge
    // and move on rather than guessing which call this belongs to.
    return c.text("OK");
  }

  const { valid } = await resolveVoiceOrgAndVerify(
    c,
    body,
    (await getDb().query.organizations.findFirst({ where: eq(organizations.id, existingCall.organizationId) }))?.phone || ""
  );
  if (!valid) return c.text("Unauthorized", 401);

  const mappedStatus = mapTwilioCallStatus(callStatus);

  if (mappedStatus === "completed") {
    // onCallCompleted owns the status="completed" flip (and its own guard
    // against firing twice) — this handler must not set it separately, or
    // the two would race each other for the exact same field.
    if (duration > 0) await updateCall(existingCall.id, existingCall.organizationId, { duration });

    const won = await onCallCompleted(
      existingCall.organizationId,
      existingCall.id,
      existingCall.leadId,
      existingCall.customerId,
      existingCall.phoneNumber,
      existingCall.direction,
      duration
    );
    if (won) {
      await getDb().insert(activities).values({
        organizationId: existingCall.organizationId,
        actorType: "system",
        entityType: "call",
        entityId: existingCall.id,
        action: "Call completed",
        description: duration > 0 ? `Duration: ${Math.floor(duration / 60)}m ${duration % 60}s` : undefined,
      });
    }
  } else {
    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (duration > 0) updateData.duration = duration;
    if (["busy", "failed", "no_answer", "canceled"].includes(mappedStatus)) {
      updateData.endedAt = new Date();
    }
    await updateCall(existingCall.id, existingCall.organizationId, updateData);

    if (["no_answer", "busy", "failed"].includes(mappedStatus)) {
      await getDb().insert(activities).values({
        organizationId: existingCall.organizationId,
        actorType: "system",
        entityType: "call",
        entityId: existingCall.id,
        action: `Call ${mappedStatus.replace("_", " ")}`,
        description: duration > 0 ? `Duration: ${Math.floor(duration / 60)}m ${duration % 60}s` : undefined,
      });
    }
  }

  return c.text("OK");
});

// ── Voice Recording Webhook ──
app.post("/api/webhooks/voice/recording", async (c) => {
  const body = await c.req.parseBody();
  const recordingUrl = (body.RecordingUrl as string) || "";
  const recordingSid = (body.RecordingSid as string) || "";
  const recordingDuration = parseInt((body.RecordingDuration as string) || "0", 10);
  const callSid = (body.CallSid as string) || "";

  if (!callSid) return c.text("OK");

  const existingCall = await findCallByTwilioSid(callSid);
  if (!existingCall) return c.text("OK");

  const { valid } = await resolveVoiceOrgAndVerify(
    c,
    body,
    (await getDb().query.organizations.findFirst({ where: eq(organizations.id, existingCall.organizationId) }))?.phone || ""
  );
  if (!valid) return c.text("Unauthorized", 401);

  await updateCall(existingCall.id, existingCall.organizationId, {
    recordingUrl: recordingUrl || undefined,
    recordingSid: recordingSid || undefined,
    recordingDuration: recordingDuration || undefined,
    transcriptStatus: "pending",
  });

  return c.text("OK");
});

app.post("/api/webhooks/email", async (c) => {
  const db = getDb();
  const body = await c.req.parseBody();

  const fromEmail = (body.From as string) || "";
  const toEmail = (body.To as string) || "";
  const textBody = (body.Body as string) || "";
  const subject = (body.Subject as string) || "Email Update";

  if (!fromEmail || !textBody) {
    return c.json({ success: false, error: "Missing parameters" }, 400);
  }

  try {
    // The receiving address is the tenant routing key. Providers should sign
    // requests upstream; production rejects an unconfigured webhook secret.
    const emailSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (env.isProduction && (!emailSecret || !safeCompare(c.req.header("x-webhook-secret") ?? "", emailSecret))) return c.json({ success: false }, 401);
    let organization = toEmail ? await db.query.organizations.findFirst({ where: eq(organizations.email, toEmail) }) : null;
    if (!organization && !env.isProduction) {
      organization = await db.query.organizations.findFirst();
    }
    if (!organization) return c.json({ success: false, error: "Unknown recipient" }, 404);
    let customer = await db.query.customers.findFirst({
      where: and(eq(customers.email, fromEmail), eq(customers.organizationId, organization.id)),
    });

    if (!customer) {
      const [custResult] = await db.insert(customers).values({
        organizationId: organization.id,
        firstName: "Inbound",
        lastName: fromEmail.split("@")[0],
        email: fromEmail,
        source: "email",
        status: "active",
      }).$returningId();

      customer = await db.query.customers.findFirst({
        where: eq(customers.id, custResult.id),
      });
    }

    if (customer) {
      let conv = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.customerId, customer.id),
          eq(conversations.organizationId, organization.id),
          eq(conversations.channel, "email"),
          eq(conversations.status, "open")
        ),
      });

      if (!conv) {
        const [convResult] = await db.insert(conversations).values({
          organizationId: organization.id,
          customerId: customer.id,
          channel: "email",
          subject,
          status: "open",
          priority: "medium",
          messageCount: 0,
          unreadCount: 1,
          aiHandled: true,
        }).$returningId();

        conv = await db.query.conversations.findFirst({
          where: eq(conversations.id, convResult.id),
        });
      } else {
        await db.update(conversations)
          .set({
            unreadCount: (conv.unreadCount ?? 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conv.id));
      }

      if (conv) {
        await createMessage({
          conversationId: conv.id,
          senderType: "customer",
          content: textBody,
        });

        await db.insert(activities).values({
          organizationId: organization.id,
          actorType: "customer",
          entityType: "conversation",
          entityId: conv.id,
          action: "Received Email",
          description: `Email from ${customer.firstName}: "${subject}"`,
        });

        if (conv.aiHandled) {
          triggerAIAutoReply(conv.id, textBody).catch(err => {
            console.error("AI Auto-responder error:", err);
          });
        }
      }
    }
  } catch (error) {
    console.error("Error processing inbound Email webhook:", error);
  }

  return c.json({ success: true });
});

// ── Stripe Billing Webhook ──
app.post("/api/webhooks/stripe", async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json({ success: true, message: "Stripe webhook received (unconfigured test mode)" });
  }

  const db = getDb();
  const signature = c.req.header("stripe-signature");
  const rawBody = await c.req.text();

  let event: import("stripe").default.Event;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
    event = stripe.webhooks.constructEvent(rawBody, signature || "", webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return c.json({ error: "Webhook verification failed" }, 400);
  }

  // Stripe retries deliveries on timeout/non-2xx, so the same event id can
  // arrive more than once. The unique constraint on stripeEventId makes this
  // the idempotency guard — a duplicate insert throws and we skip reprocessing.
  try {
    await db.insert(stripeEvents).values({ stripeEventId: event.id, type: event.type });
  } catch {
    return c.json({ received: true, duplicate: true });
  }

  try {
    const { planFromPriceId, PLAN_LIMITS } = await import("./lib/billing");

    const findSubByOrgId = (orgId: number) =>
      db.query.subscriptions.findFirst({ where: eq(subscriptions.organizationId, orgId) });
    const findSubByStripeIds = (customerId?: string | null, subscriptionId?: string | null) =>
      db.query.subscriptions.findFirst({
        where: (s, { or, eq }) =>
          or(
            subscriptionId ? eq(s.stripeSubscriptionId, subscriptionId) : undefined,
            customerId ? eq(s.stripeCustomerId, customerId) : undefined
          ),
      });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as import("stripe").default.Checkout.Session;
      const orgId = parseInt(session.metadata?.organizationId || "0");
      const plan = (session.metadata?.plan || "professional") as "starter" | "professional" | "enterprise";
      const limits = PLAN_LIMITS[plan];

      if (orgId) {
        await db
          .update(subscriptions)
          .set({
            plan,
            status: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            ...limits,
          })
          .where(eq(subscriptions.organizationId, orgId));

        console.log(`Organization #${orgId} upgraded to ${plan} plan via Stripe Checkout.`);
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object as import("stripe").default.Subscription;
      const orgId = parseInt(sub.metadata?.organizationId || "0");
      const local = orgId ? await findSubByOrgId(orgId) : await findSubByStripeIds(sub.customer as string, sub.id);
      if (local) {
        const item = sub.items.data[0];
        const plan = planFromPriceId(item?.price?.id);
        const statusMap: Record<string, typeof subscriptions.$inferSelect.status> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "cancelled",
          unpaid: "past_due",
          paused: "paused",
        };

        // Snapshot the active coupon/promotion-code discount (if any) so the
        // Billing tab can show it without a live Stripe API call. Cleared to
        // null here too, so an expired/removed discount disappears on the
        // next webhook delivery instead of lingering stale.
        const firstDiscount = sub.discounts?.[0];
        const discountSource = firstDiscount && typeof firstDiscount === "object" ? firstDiscount.source : null;
        const coupon = discountSource?.coupon && typeof discountSource.coupon === "object" ? discountSource.coupon : null;
        const discountAmount = coupon?.percent_off != null
          ? `${coupon.percent_off}% off`
          : coupon?.amount_off != null
          ? `${(coupon.amount_off / 100).toFixed(2)} ${(coupon.currency || "").toUpperCase()} off`
          : null;
        const discountSummary = discountAmount ? (coupon?.name ? `${discountAmount} (${coupon.name})` : discountAmount) : null;
        const discountEndsAt = discountSummary && typeof firstDiscount === "object" && firstDiscount.end
          ? new Date(firstDiscount.end * 1000)
          : null;

        await db
          .update(subscriptions)
          .set({
            status: statusMap[sub.status] ?? local.status,
            ...(plan ? { plan, ...PLAN_LIMITS[plan] } : {}),
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            currentPeriodStart: item?.current_period_start ? new Date(item.current_period_start * 1000) : local.currentPeriodStart,
            currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : local.currentPeriodEnd,
            discountSummary,
            discountEndsAt,
          })
          .where(eq(subscriptions.id, local.id));
        console.log(`Subscription for Organization #${local.organizationId} updated (status: ${sub.status}).`);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as import("stripe").default.Subscription;
      const orgId = parseInt(sub.metadata?.organizationId || "0");
      const local = orgId ? await findSubByOrgId(orgId) : await findSubByStripeIds(sub.customer as string, sub.id);
      if (local) {
        await db.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.id, local.id));
        console.log(`Subscription for Organization #${local.organizationId} cancelled.`);
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as import("stripe").default.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
      const local = await findSubByStripeIds(invoice.customer as string, subscriptionId);
      if (local) {
        await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.id, local.id));
        console.log(`Subscription for Organization #${local.organizationId} marked past_due (payment failed).`);
      }
    }
  } catch (err) {
    console.error("Error processing Stripe webhook:", err);
    return c.json({ error: "Webhook processing failed" }, 500);
  }

  return c.json({ received: true });
});

// ── Secure Call Recording Playback Proxy ──
// Twilio recording URLs require the account's own Basic Auth credentials and
// are not safe to hand to the browser directly (they'd leak playable media
// URLs with no tenant check). This authenticates the requesting user, checks
// they belong to the recording's organization, then streams the audio
// through this server using the org's own (or platform) Twilio credentials.
app.get("/api/recordings/:callId", async (c) => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const callId = parseInt(c.req.param("callId"), 10);
  if (!callId) return c.json({ error: "Invalid call id" }, 400);

  const call = await findCallById(callId);
  if (!call || !call.recordingUrl) return c.json({ error: "Recording not found" }, 404);

  try {
    await requireCallOrgMembership(user.id, call.organizationId);
  } catch {
    return c.json({ error: "Forbidden" }, 403);
  }

  const org = await getDb().query.organizations.findFirst({ where: eq(organizations.id, call.organizationId) });
  const accountSid = org?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = org?.twilioAuthToken ? decryptSecret(org.twilioAuthToken) : process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return c.json({ error: "Twilio is not configured for this organization" }, 409);

  const mediaUrl = call.recordingUrl.endsWith(".mp3") ? call.recordingUrl : `${call.recordingUrl}.mp3`;
  const twilioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` },
  });

  if (!twilioRes.ok || !twilioRes.body) {
    return c.json({ error: "Failed to fetch recording from Twilio" }, 502);
  }

  return new Response(twilioRes.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// ── Local Document Storage (fallback when S3/R2 isn't configured) ──
// documentRouter.getPresignedUploadUrl hands out a URL under this path
// instead of null when there's no S3 client, and the frontend's existing
// upload code does a same PUT it would do against a real presigned S3 URL —
// see api/lib/localStorage.ts for the full reasoning.

// Every fileKey this app generates is "orgs/{organizationId}/..." — parsed
// here to re-check org membership independently of whatever the client
// claims, since there's no documents row yet to authorize against at upload
// time (that only gets created afterward, via document.confirmUpload).
function orgIdFromFileKey(fileKey: string): number | null {
  const match = /^orgs\/(\d+)\//.exec(fileKey);
  return match ? parseInt(match[1], 10) : null;
}

app.put("/api/uploads/local/*", async (c) => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const fileKey = c.req.path.replace("/api/uploads/local/", "");
  const orgId = orgIdFromFileKey(fileKey);
  if (!orgId) return c.json({ error: "Invalid file key" }, 400);

  try {
    await requireCallOrgMembership(user.id, orgId);
  } catch {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Re-enforced here, not just trusted from the earlier getPresignedUploadUrl
  // call — this endpoint accepts a raw request body directly, so nothing
  // stops a client from skipping that step and PUTing straight to it.
  const contentType = c.req.header("content-type") || "";
  if (!isAllowedUploadMimeType(contentType)) {
    return c.json({ error: "This file type is not allowed" }, 400);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit` }, 400);
  }

  await saveLocalFile(fileKey, Buffer.from(body));
  return c.json({ success: true });
});

app.get("/api/uploads/local/*", async (c) => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const fileKey = c.req.path.replace("/api/uploads/local/", "");

  // Authorize against the real documents row (same pattern as the recordings
  // proxy above) rather than trusting the org id embedded in the URL alone —
  // this is what actually confirms the file belongs to an org this user is a
  // member of, and gives us the real filename/mime type for the response.
  const doc = await getDb().query.documents.findFirst({
    where: (d, { like }) => like(d.url, `%${fileKey}`),
  });
  if (!doc) return c.json({ error: "File not found" }, 404);

  try {
    await requireCallOrgMembership(user.id, doc.organizationId);
  } catch {
    return c.json({ error: "Forbidden" }, 403);
  }

  const data = await readLocalFile(fileKey);
  if (!data) return c.json({ error: "File not found on disk" }, 404);

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
