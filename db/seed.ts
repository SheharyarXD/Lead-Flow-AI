import { getDb } from "../api/queries/connection";
import {
  users,
  organizations,
  organizationMembers,
  subscriptions,
  customers,
  leads,
  conversations,
  messages,
  calls,
  appointments,
  tasks,
  automations,
  activities,
  knowledgeBase,
} from "./schema";

async function seed() {
  const db = getDb();

  console.log("Seeding database...");

  // Create a demo organization
  const [orgResult] = await db.insert(organizations).values({
    name: "Acme Dental Care",
    slug: "acme-dental",
    industry: "Healthcare",
    website: "https://acmedental.example.com",
    phone: "+1 (555) 123-4567",
    email: "contact@acmedental.example.com",
    address: "123 Main Street, Suite 100, San Francisco, CA 94105",
    timezone: "America/Los_Angeles",
    aiEnabled: true,
    aiInstructions: "You are a friendly AI receptionist for Acme Dental Care. Help patients schedule appointments, answer questions about services, and collect lead information. Be professional yet warm.",
    greetingMessage: "Hello! Thank you for calling Acme Dental Care. I'm your AI assistant. How can I help you today?",
  }).$returningId();

  const orgId = orgResult.id;
  console.log(`Created organization: ${orgId}`);

  // Create subscription
  await db.insert(subscriptions).values({
    organizationId: orgId,
    plan: "professional",
    status: "active",
    minutesIncluded: 500,
    minutesUsed: 142,
    leadsLimit: 500,
    usersLimit: 5,
    features: ["ai_calls", "sms", "email", "calendar", "reports"],
  });

  // Create knowledge base entries
  await db.insert(knowledgeBase).values([
    {
      organizationId: orgId,
      type: "service",
      title: "General Dentistry",
      content: "Our general dentistry services include cleanings, exams, fillings, and preventive care. Regular checkups every 6 months are recommended.",
      category: "Services",
      aiEnabled: true,
    },
    {
      organizationId: orgId,
      type: "service",
      title: "Cosmetic Dentistry",
      content: "We offer teeth whitening, veneers, bonding, and smile makeovers. Free consultation available for cosmetic procedures.",
      category: "Services",
      aiEnabled: true,
    },
    {
      organizationId: orgId,
      type: "faq",
      title: "Office Hours",
      content: "Monday-Friday: 8:00 AM - 6:00 PM. Saturday: 9:00 AM - 2:00 PM. Sunday: Closed. Emergency appointments available.",
      category: "General",
      aiEnabled: true,
    },
    {
      organizationId: orgId,
      type: "faq",
      title: "Insurance Accepted",
      content: "We accept most major insurance plans including Delta Dental, Cigna, Aetna, and Blue Cross. We also offer flexible payment plans.",
      category: "Billing",
      aiEnabled: true,
    },
    {
      organizationId: orgId,
      type: "pricing",
      title: "New Patient Special",
      content: "New patients receive a comprehensive exam, X-rays, and cleaning for just $99. Regular price $250.",
      category: "Promotions",
      aiEnabled: true,
    },
  ]);

  // Create customers
  const customerData = [
    { firstName: "Sarah", lastName: "Johnson", email: "sarah.j@email.com", phone: "+1 (555) 234-5678", source: "phone" as const, status: "active" as const },
    { firstName: "Michael", lastName: "Chen", email: "mchen@email.com", phone: "+1 (555) 345-6789", source: "website" as const, status: "active" as const },
    { firstName: "Emily", lastName: "Davis", email: "emily.d@email.com", phone: "+1 (555) 456-7890", source: "referral" as const, status: "active" as const },
    { firstName: "James", lastName: "Wilson", email: "jwilson@email.com", phone: "+1 (555) 567-8901", source: "sms" as const, status: "active" as const },
    { firstName: "Lisa", lastName: "Brown", email: "lisa.brown@email.com", phone: "+1 (555) 678-9012", source: "social" as const, status: "active" as const },
    { firstName: "Robert", lastName: "Taylor", email: "robert.t@email.com", phone: "+1 (555) 789-0123", source: "phone" as const, status: "inactive" as const },
    { firstName: "Amanda", lastName: "Martinez", email: "amanda.m@email.com", phone: "+1 (555) 890-1234", source: "website" as const, status: "active" as const },
    { firstName: "David", lastName: "Anderson", email: "david.a@email.com", phone: "+1 (555) 901-2345", source: "referral" as const, status: "active" as const },
  ];

  const customerIds: number[] = [];
  for (const c of customerData) {
    const [result] = await db.insert(customers).values({
      organizationId: orgId,
      ...c,
    }).$returningId();
    customerIds.push(result.id);
  }

  // Create leads
  const leadData = [
    { firstName: "Jennifer", lastName: "Smith", email: "jennifer.smith@email.com", phone: "+1 (555) 111-2222", company: "Tech Corp", title: "Manager", source: "ai_call" as const, status: "new" as const, priority: "high" as const, estimatedValue: 2500, customerId: undefined },
    { firstName: "Christopher", lastName: "Lee", email: "chris.lee@email.com", phone: "+1 (555) 222-3333", company: "", title: "", source: "website_form" as const, status: "contacted" as const, priority: "medium" as const, estimatedValue: 1200, customerId: undefined },
    { firstName: "Maria", lastName: "Garcia", email: "maria.g@email.com", phone: "+1 (555) 333-4444", company: "Garcia LLC", title: "CEO", source: "referral" as const, status: "qualified" as const, priority: "high" as const, estimatedValue: 5000, customerId: customerIds[0] },
    { firstName: "William", lastName: "Johnson", email: "will.j@email.com", phone: "+1 (555) 444-5555", company: "", title: "", source: "ai_chat" as const, status: "proposal" as const, priority: "urgent" as const, estimatedValue: 8000, customerId: customerIds[1] },
    { firstName: "Patricia", lastName: "White", email: "pat.white@email.com", phone: "+1 (555) 555-6666", company: "White & Co", title: "Director", source: "phone" as const, status: "won" as const, priority: "medium" as const, estimatedValue: 3500, customerId: customerIds[2] },
    { firstName: "Thomas", lastName: "Harris", email: "tom.harris@email.com", phone: "+1 (555) 666-7777", company: "", title: "", source: "sms" as const, status: "lost" as const, priority: "low" as const, estimatedValue: 900, customerId: undefined },
    { firstName: "Linda", lastName: "Clark", email: "linda.c@email.com", phone: "+1 (555) 777-8888", company: "Clark Design", title: "Owner", source: "ai_call" as const, status: "new" as const, priority: "medium" as const, estimatedValue: 1800, customerId: undefined },
    { firstName: "Charles", lastName: "Rodriguez", email: "charles.r@email.com", phone: "+1 (555) 888-9999", company: "", title: "", source: "website_form" as const, status: "contacted" as const, priority: "low" as const, estimatedValue: 600, customerId: undefined },
    { firstName: "Barbara", lastName: "Lewis", email: "barbara.l@email.com", phone: "+1 (555) 999-0000", company: "Lewis Partners", title: "Partner", source: "referral" as const, status: "negotiation" as const, priority: "high" as const, estimatedValue: 4200, customerId: customerIds[3] },
    { firstName: "Joseph", lastName: "Walker", email: "joe.walker@email.com", phone: "+1 (555) 000-1111", company: "", title: "", source: "ai_chat" as const, status: "qualified" as const, priority: "medium" as const, estimatedValue: 2200, customerId: undefined },
  ];

  const leadIds: number[] = [];
  for (const l of leadData) {
    const [result] = await db.insert(leads).values({
      organizationId: orgId,
      ...l,
    }).$returningId();
    leadIds.push(result.id);
  }

  // Create conversations
  const convData = [
    { customerId: customerIds[0], leadId: leadIds[2], channel: "ai_chat" as const, subject: "Teeth whitening inquiry", status: "open" as const, priority: "high" as const, aiHandled: true, aiSummary: "Customer interested in professional teeth whitening. Quoted $399. Scheduled consultation for next week.", messageCount: 8, unreadCount: 1 },
    { customerId: customerIds[1], leadId: leadIds[3], channel: "phone" as const, subject: "Emergency appointment request", status: "open" as const, priority: "urgent" as const, aiHandled: true, aiSummary: "Customer has toothache, needs emergency appointment. AI scheduled for tomorrow 10 AM.", messageCount: 5, unreadCount: 0 },
    { customerId: customerIds[2], channel: "sms" as const, subject: "Insurance verification", status: "pending" as const, priority: "medium" as const, aiHandled: false, messageCount: 3, unreadCount: 1 },
    { customerId: customerIds[3], leadId: leadIds[8], channel: "email" as const, subject: "Cosmetic consultation follow-up", status: "open" as const, priority: "medium" as const, aiHandled: true, aiSummary: "Follow-up on veneer consultation. Customer needs time to consider options.", messageCount: 6, unreadCount: 0 },
    { customerId: customerIds[4], channel: "web_chat" as const, subject: "New patient registration", status: "closed" as const, priority: "low" as const, aiHandled: true, messageCount: 12, unreadCount: 0 },
    { customerId: customerIds[5], channel: "ai_chat" as const, subject: "Root canal questions", status: "open" as const, priority: "high" as const, aiHandled: true, aiSummary: "Customer anxious about root canal procedure. AI provided detailed explanation and calming reassurance.", messageCount: 10, unreadCount: 2 },
  ];

  const convIds: number[] = [];
  for (const c of convData) {
    const [result] = await db.insert(conversations).values({
      organizationId: orgId,
      ...c,
    }).$returningId();
    convIds.push(result.id);
  }

  // Create messages for conversations
  const messageData = [
    { conversationId: convIds[0], senderType: "customer" as const, content: "Hi, I'm interested in teeth whitening. How much does it cost?" },
    { conversationId: convIds[0], senderType: "ai" as const, content: "Hello! Our professional teeth whitening service is $399. We also have a special promotion - new patients get 20% off their first cosmetic procedure!" },
    { conversationId: convIds[0], senderType: "customer" as const, content: "That sounds great! How long does the procedure take?" },
    { conversationId: convIds[0], senderType: "ai" as const, content: "The in-office whitening takes about 90 minutes, and you'll see results immediately. We also offer take-home trays for $199. Would you like me to schedule a consultation?" },
    { conversationId: convIds[1], senderType: "customer" as const, content: "I have a severe toothache. Can I get an emergency appointment?" },
    { conversationId: convIds[1], senderType: "ai" as const, content: "I'm sorry to hear that! Yes, we have emergency slots available. Our dentist Dr. Smith can see you tomorrow at 10:00 AM or 2:00 PM. Which works better for you?" },
    { conversationId: convIds[1], senderType: "customer" as const, content: "10 AM please" },
    { conversationId: convIds[1], senderType: "ai" as const, content: "Perfect! I've scheduled you for tomorrow at 10:00 AM with Dr. Smith. Please arrive 15 minutes early to complete paperwork. Is there anything else I can help with?" },
  ];

  for (const m of messageData) {
    await db.insert(messages).values(m);
  }

  // Create calls
  const callData = [
    { customerId: customerIds[0], leadId: leadIds[2], phoneNumber: "+1 (555) 234-5678", direction: "inbound" as const, status: "completed" as const, duration: 245, aiHandled: true, aiSummary: "Discussed teeth whitening options. Customer booked consultation.", transcript: "AI: Hello, thank you for calling... Customer: Hi, I want to know about whitening..." },
    { customerId: customerIds[1], leadId: leadIds[3], phoneNumber: "+1 (555) 345-6789", direction: "inbound" as const, status: "completed" as const, duration: 180, aiHandled: true, aiSummary: "Emergency appointment scheduled for toothache.", transcript: "AI: How can I help? Customer: I have pain..." },
    { phoneNumber: "+1 (555) 123-9999", direction: "inbound" as const, status: "missed" as const, duration: 0, aiHandled: false, notes: "No voicemail left" },
    { customerId: customerIds[2], phoneNumber: "+1 (555) 456-7890", direction: "outbound" as const, status: "completed" as const, duration: 120, aiHandled: true, aiSummary: "Follow-up call for post-procedure care. Customer doing well.", transcript: "AI: Checking in after your procedure... Customer: Doing great, thanks..." },
    { phoneNumber: "+1 (555) 987-6543", direction: "inbound" as const, status: "voicemail" as const, duration: 45, aiHandled: false, notes: "Left voicemail requesting callback about Invisalign" },
    { customerId: customerIds[3], leadId: leadIds[8], phoneNumber: "+1 (555) 567-8901", direction: "inbound" as const, status: "completed" as const, duration: 310, aiHandled: true, aiSummary: "Detailed discussion about veneer options and pricing. Customer considering.", transcript: "AI: Thank you for calling... Customer: Tell me about veneers..." },
  ];

  for (const c of callData) {
    await db.insert(calls).values({ organizationId: orgId, ...c });
  }

  // Create appointments
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const apptData = [
    { customerId: customerIds[0], title: "Teeth Whitening Consultation", startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0), endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30), status: "scheduled" as const, type: "consultation" as const, location: "Office - Room 1" },
    { customerId: customerIds[1], title: "Emergency Exam", startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0), endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 45), status: "confirmed" as const, type: "call" as const, location: "Office - Room 2" },
    { customerId: customerIds[2], title: "Regular Cleaning", startTime: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 9, 0), endTime: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 9, 45), status: "scheduled" as const, type: "meeting" as const, location: "Office - Room 1" },
    { customerId: customerIds[3], title: "Veneer Follow-up", startTime: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 11, 0), endTime: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 11, 30), status: "scheduled" as const, type: "follow_up" as const, location: "Office - Room 3" },
    { customerId: customerIds[4], title: "New Patient Exam", startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 0), endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 45), status: "confirmed" as const, type: "meeting" as const, location: "Office - Room 1" },
  ];

  for (const a of apptData) {
    await db.insert(appointments).values({ organizationId: orgId, ...a });
  }

  // Create tasks
  const taskData = [
    { customerId: customerIds[0], leadId: leadIds[2], title: "Follow up on whitening consultation", type: "follow_up" as const, status: "pending" as const, priority: "high" as const, dueDate: tomorrow },
    { customerId: customerIds[1], title: "Confirm emergency appointment", type: "call" as const, status: "completed" as const, priority: "urgent" as const, dueDate: now },
    { leadId: leadIds[0], title: "Call new lead about general dentistry", type: "call" as const, status: "pending" as const, priority: "medium" as const, dueDate: dayAfter },
    { customerId: customerIds[3], leadId: leadIds[8], title: "Send veneer pricing proposal", type: "email" as const, status: "pending" as const, priority: "high" as const, dueDate: tomorrow },
    { leadId: leadIds[6], title: "Schedule callback for Linda Clark", type: "reminder" as const, status: "pending" as const, priority: "low" as const, dueDate: dayAfter },
    { customerId: customerIds[4], title: "Send new patient welcome packet", type: "email" as const, status: "in_progress" as const, priority: "medium" as const, dueDate: tomorrow },
  ];

  for (const t of taskData) {
    await db.insert(tasks).values({ organizationId: orgId, ...t });
  }

  // Create automations
  await db.insert(automations).values([
    {
      organizationId: orgId,
      name: "New Lead Welcome",
      description: "Automatically send welcome SMS to new leads",
      trigger: "lead_created" as const,
      actions: [{ type: "send_sms", template: "welcome_sms" }],
      status: "active" as const,
      runCount: 45,
    },
    {
      organizationId: orgId,
      name: "Follow-up Reminder",
      description: "Create follow-up task 24 hours after initial contact",
      trigger: "conversation_started" as const,
      actions: [{ type: "create_task", template: "follow_up" }],
      status: "active" as const,
      runCount: 128,
    },
    {
      organizationId: orgId,
      name: "Missed Call Alert",
      description: "Alert team members about missed calls",
      trigger: "call_completed" as const,
      conditions: [{ field: "status", operator: "equals", value: "missed" }],
      actions: [{ type: "send_notification", channel: "slack" }],
      status: "active" as const,
      runCount: 12,
    },
  ]);

  // Create activities
  const activityData = [
    { entityType: "lead" as const, entityId: leadIds[0], action: "created", description: "New lead created from AI call" },
    { entityType: "conversation" as const, entityId: convIds[0], action: "started", description: "AI chat conversation started" },
    { entityType: "call" as const, entityId: 1, action: "completed", description: "Inbound call completed - 4m 5s" },
    { entityType: "appointment" as const, entityId: 1, action: "scheduled", description: "Teeth whitening consultation scheduled" },
    { entityType: "task" as const, entityId: 1, action: "created", description: "Follow-up task created" },
  ];

  for (const a of activityData) {
    await db.insert(activities).values({ organizationId: orgId, actorType: "system", ...a });
  }

  console.log("Seed completed successfully!");
}

seed().catch(console.error);
