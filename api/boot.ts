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
import { customers, conversations, messages, activities } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createMessage } from "./queries/conversations";
import { triggerAIAutoReply } from "./lib/ai-agent";

app.post("/api/webhooks/sms", async (c) => {
  const db = getDb();
  const body = await c.req.parseBody();
  
  const fromNum = (body.From as string) || "";
  const textBody = (body.Body as string) || "";
  
  if (!fromNum || !textBody) {
    c.header("Content-Type", "application/xml");
    return c.text("<Response></Response>");
  }

  try {
    let customer = await db.query.customers.findFirst({
      where: eq(customers.phone, fromNum),
    });

    if (!customer) {
      const [custResult] = await db.insert(customers).values({
        organizationId: 1,
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
          organizationId: 1,
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
          organizationId: 1,
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
  const textBody = (body.Body as string) || "";
  const subject = (body.Subject as string) || "Email Update";

  if (!fromEmail || !textBody) {
    return c.json({ success: false, error: "Missing parameters" }, 400);
  }

  try {
    let customer = await db.query.customers.findFirst({
      where: eq(customers.email, fromEmail),
    });

    if (!customer) {
      const [custResult] = await db.insert(customers).values({
        organizationId: 1,
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
          organizationId: 1,
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
          organizationId: 1,
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
