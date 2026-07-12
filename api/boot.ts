import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { Paths } from "@contracts/constants";

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
import { customers, conversations, activities, organizations } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createMessage } from "./queries/conversations";
import { triggerAIAutoReply } from "./lib/ai-agent";
import twilio from "twilio";

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
      where: eq(customers.phone, fromNum),
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
    if (env.isProduction && (!emailSecret || c.req.header("x-webhook-secret") !== emailSecret)) return c.json({ success: false }, 401);
    let organization = toEmail ? await db.query.organizations.findFirst({ where: eq(organizations.email, toEmail) }) : null;
    if (!organization && !env.isProduction) {
      organization = await db.query.organizations.findFirst();
    }
    if (!organization) return c.json({ success: false, error: "Unknown recipient" }, 404);
    let customer = await db.query.customers.findFirst({
      where: eq(customers.email, fromEmail),
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
