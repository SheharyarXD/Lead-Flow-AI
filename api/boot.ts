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

// ── Inbound Webhooks for SMS & Email ──
import { getDb } from "./queries/connection";
import { customers, conversations, activities, organizations, subscriptions } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { createMessage } from "./queries/conversations";
import { triggerAIAutoReply } from "./lib/ai-agent";
import twilio from "twilio";
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
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

// ── Inbound Voice Webhook ──
app.post("/api/webhooks/voice", async (c) => {
  const body = await c.req.parseBody();
  const callerNumber = (body.From as string) || "";
  const callSid = (body.CallSid as string) || "";

  console.log(`Inbound Voice call received from ${callerNumber}. CallSid: ${callSid}`);

  c.header("Content-Type", "application/xml");
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling. Our AI receptionist is taking your call, please leave a message after the tone.</Say>
    <Record maxLength="60" finishOnKey="#" />
</Response>`;
  return c.text(twiml);
});

// ── Voice Call Status Webhook ──
app.post("/api/webhooks/voice/status", async (c) => {
  const body = await c.req.parseBody();
  const callSid = (body.CallSid as string) || "";
  const callStatus = (body.CallStatus as string) || "";
  const duration = parseInt((body.CallDuration as string) || "0");

  console.log(`Voice call status update. CallSid: ${callSid}, Status: ${callStatus}, Duration: ${duration}`);
  return c.text("OK");
});

// ── Voice Recording Webhook ──
app.post("/api/webhooks/voice/recording", async (c) => {
  const body = await c.req.parseBody();
  const recordingUrl = (body.RecordingUrl as string) || "";
  const recordingDuration = parseInt((body.RecordingDuration as string) || "0");
  const callSid = (body.CallSid as string) || "";

  console.log(`Voice recording completed. CallSid: ${callSid}, URL: ${recordingUrl}, Duration: ${recordingDuration}`);
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

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
    const event = stripe.webhooks.constructEvent(rawBody, signature || "", webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const orgId = parseInt(session.metadata?.organizationId || "0");
      const plan = (session.metadata?.plan || "professional") as "starter" | "professional" | "enterprise";

      if (orgId) {
        await db
          .update(subscriptions)
          .set({
            plan,
            status: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            leadsLimit: plan === "enterprise" ? 10000 : plan === "professional" ? 1000 : 100,
            minutesIncluded: plan === "enterprise" ? 5000 : plan === "professional" ? 1000 : 100,
          })
          .where(eq(subscriptions.organizationId, orgId));

        console.log(`Successfully upgraded Organization #${orgId} to ${plan} plan via Stripe Checkout!`);
      }
    }
  } catch (err) {
    console.error("Error processing Stripe webhook:", err);
    return c.json({ error: "Webhook verification failed" }, 400);
  }

  return c.json({ received: true });
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
