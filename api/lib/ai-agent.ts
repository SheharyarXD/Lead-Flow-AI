import { getDb } from "../queries/connection";
import { knowledgeBase, organizations, conversations, activities, leads } from "@db/schema";
import { eq } from "drizzle-orm";
import { createMessage } from "../queries/conversations";

export async function triggerAIAutoReply(conversationId: number, userMessage: string) {
  const db = getDb();

  // 1. Fetch conversation
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!conv || !conv.aiHandled) return;

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

  const apiKey = org?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
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
        const completion = await response.json() as any;
        responseText = completion.choices?.[0]?.message?.content?.trim() || "";
      } else {
        console.warn("OpenAI API returned non-ok status:", response.status);
      }
    } catch (err) {
      console.error("OpenAI API call failed, falling back to rules:", err);
    }
  }

  // If OpenAI was not configured or failed, use local matching rules
  if (!responseText) {
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
    responseText = `Hello! Thanks for reaching out to ${org?.name || "us"}. I've received your query: "${userMessage}". One of our team members will get back to you shortly. Feel free to let me know if you want to book or reschedule any slots!`;
  }

  // 5. Save the AI message back into the database
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
}
