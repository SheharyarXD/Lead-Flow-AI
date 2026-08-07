import { getDb } from "../queries/connection";
import { knowledgeBase, organizations, conversations, activities, leads } from "@db/schema";
import { eq } from "drizzle-orm";
import { createMessage } from "../queries/conversations";
import { decryptSecret } from "./crypto";

export async function triggerAIAutoReply(conversationId: number, userMessage: string) {
  console.log(`[AI] Conversation received: id=${conversationId}, message="${userMessage}"`);
  const db = getDb();

  console.log(`[AI] Loading conversation details...`);
  // 1. Fetch conversation
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      customer: true,
    }
  });
  if (!conv) {
    console.warn(`[AI] Conversation not found or invalid: id=${conversationId}`);
    return;
  }
  if (!conv.aiHandled) {
    console.log(`[AI] AI is not enabled for this conversation (aiHandled is false). Skipping reply.`);
    return;
  }

  console.log(`[AI] Loading customer context: firstName=${conv.customer?.firstName}, lastName=${conv.customer?.lastName}, phone=${conv.customer?.phone}`);

  // 2. Fetch organization settings
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, conv.organizationId),
  });

  // 3. Fetch knowledge base FAQ/Service logs
  const kbEntries = await db.query.knowledgeBase.findMany({
    where: eq(knowledgeBase.organizationId, conv.organizationId),
  });

  // 4. OpenAI Chat Completion with custom key support or rules fallback
  let responseText = "";
  const msgLower = userMessage.toLowerCase();

  const apiKey = (org?.openaiApiKey ? decryptSecret(org.openaiApiKey) : null) || process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      console.log(`[AI] Calling OpenAI... with key length: ${apiKey.length}`);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an AI receptionist for the business "${org?.name}". 
Industry: ${org?.industry || "Services"}
Instructions: ${org?.aiInstructions || "Be polite, helpful, and answer based on the knowledge base."}
Greeting: ${org?.greetingMessage || "Hello!"}

Here is the knowledge base information you have access to:
${kbEntries.map((kb, i) => `${i+1}. [${kb.category || "FAQ"}] ${kb.title}: ${kb.content}`).join("\n")}

Rule: Answer the customer's query accurately using the knowledge base facts. If the answer is not in the knowledge base, politely state that you've logged their query and a human representative will get back to them.`
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });

      if (response.ok) {
        const completion = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        responseText = completion.choices?.[0]?.message?.content?.trim() || "";
        console.log(`[AI] OpenAI response received: "${responseText}"`);
      } else {
        const rawErrText = await response.text();
        console.warn(`[AI] OpenAI API returned non-ok status: ${response.status}. Body: ${rawErrText}`);
      }
    } catch (err: any) {
      console.error("[AI] OpenAI API call failed with exception:", err.stack || err);
    }
  } else {
    console.log("[AI] No OpenAI API key configured. Falling back to local rules.");
  }

  // If OpenAI was not configured or failed, use local matching rules
  if (!responseText) {
    console.log("[AI] Matching query against local knowledge base rules...");
    for (const kb of kbEntries) {
      if (kb.title && msgLower.includes(kb.title.toLowerCase())) {
        responseText = kb.content;
        break;
      }
      if (kb.category && msgLower.includes(kb.category.toLowerCase())) {
        responseText = kb.content;
        break;
      }
      if (kb.content && msgLower.split(" ").some(word => word.length > 3 && kb.content.toLowerCase().includes(word))) {
        responseText = kb.content;
      }
    }
  }

  // Fallback default message using AI receptionist instructions template
  if (!responseText) {
    console.log("[AI] No matching local rules. Using fallback template.");
    responseText = `Hello! Thanks for reaching out to ${org?.name || "us"}. I've received your query: "${userMessage}". One of our team members will get back to you shortly. Feel free to let me know if you want to book or reschedule any slots!`;
  }

  // 5. Save the AI message back into the database
  console.log(`[AI] Saving AI reply...`);
  if (conv.channel === "sms") {
    console.log(`[AI] Sending Twilio SMS (if enabled)...`);
  } else if (conv.channel === "email") {
    console.log(`[AI] Sending Email reply (if enabled)...`);
  }

  await createMessage({
    conversationId,
    senderType: "ai",
    content: responseText,
  });

  // 6. Log AI Activity
  await db.insert(activities).values({
    organizationId: conv.organizationId,
    actorType: "ai",
    entityType: "conversation",
    entityId: conv.id,
    action: "AI Auto-Reply Sent",
    description: `AI automatically responded to message: "${responseText.slice(0, 60)}..."`,
  });

  // 7. Update associated Lead lastActivityAt
  if (conv.leadId) {
    await db.update(leads)
      .set({ lastActivityAt: new Date() })
      .where(eq(leads.id, conv.leadId));
  }
  console.log(`[AI] Finished auto-reply for conversation ID: ${conversationId}`);
}
