import { getDb } from "../queries/connection";
import { knowledgeBase, organizations, conversations } from "@db/schema";
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

  // 4. Simple matching rules based on user keywords
  let responseText = "";
  const msgLower = userMessage.toLowerCase();

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
}
