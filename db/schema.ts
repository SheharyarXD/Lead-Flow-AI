import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  json,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Users (managed by OAuth auth system) ────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Password reset tokens are stored hashed. The raw token is only ever returned by
// the development reset flow or delivered by a future mail provider.
export const passwordResetTokens = mysqlTable(
  "passwordResetTokens",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("reset_user_idx").on(table.userId),
    expiryIdx: index("reset_expiry_idx").on(table.expiresAt),
  }),
);

// ─── Organizations ────────────────────────────────────────────────────────
export const organizations = mysqlTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    industry: varchar("industry", { length: 100 }),
    website: varchar("website", { length: 500 }),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 320 }),
    address: text("address"),
    businessHours: json("businessHours").$type<Record<string, { open: string; close: string }>>(),
    timezone: varchar("timezone", { length: 100 }).default("America/New_York"),
    logo: text("logo"),
    openaiApiKey: text("openaiApiKey"),
    twilioAccountSid: text("twilioAccountSid"),
    twilioAuthToken: text("twilioAuthToken"),
    twilioPhoneNumber: varchar("twilioPhoneNumber", { length: 50 }),
    smtpHost: varchar("smtpHost", { length: 255 }),
    smtpPort: int("smtpPort"),
    smtpUser: varchar("smtpUser", { length: 255 }),
    smtpPass: text("smtpPass"),
    smtpFromEmail: varchar("smtpFromEmail", { length: 255 }),
    aiEnabled: boolean("aiEnabled").default(true),
    aiInstructions: text("aiInstructions"),
    greetingMessage: text("greetingMessage"),
    services: json("services").$type<string[]>(),
    onboardingCompletedAt: timestamp("onboardingCompletedAt"),
    status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: uniqueIndex("slug_idx").on(table.slug),
    nameIdx: index("org_name_idx").on(table.name),
    // Unique (not just indexed): inbound SMS/email webhooks resolve the tenant by
    // an exact match on this column, so two organizations sharing a number/address
    // would make routing ambiguous and could misfile a customer's messages.
    phoneIdx: uniqueIndex("org_phone_idx").on(table.phone),
    emailIdx: uniqueIndex("org_email_idx").on(table.email),
  })
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Organization Members ────────────────────────────────────────────────
export const organizationMembers = mysqlTable(
  "organizationMembers",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "admin", "manager", "member"]).default("member").notNull(),
    title: varchar("title", { length: 255 }),
    isDefault: boolean("isDefault").default(false),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgUserIdx: uniqueIndex("org_user_idx").on(table.organizationId, table.userId),
    orgIdx: index("member_org_idx").on(table.organizationId),
    userIdx: index("member_user_idx").on(table.userId),
  })
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// ─── Organization Invitations ────────────────────────────────────────────
export const organizationInvitations = mysqlTable(
  "organizationInvitations",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: mysqlEnum("role", ["admin", "manager", "member"]).default("member").notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    status: mysqlEnum("status", ["pending", "accepted", "revoked", "expired"]).default("pending").notNull(),
    invitedBy: bigint("invitedBy", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("invite_org_idx").on(table.organizationId),
    emailIdx: index("invite_email_idx").on(table.email),
    statusIdx: index("invite_status_idx").on(table.status),
  })
);

export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type InsertOrganizationInvitation = typeof organizationInvitations.$inferInsert;

// ─── Customers (people who contact the business) ────────────────────────
export const customers = mysqlTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: varchar("firstName", { length: 255 }).notNull(),
    lastName: varchar("lastName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 50 }),
    avatar: text("avatar"),
    source: mysqlEnum("source", ["website", "phone", "sms", "email", "referral", "social", "other"]).default("other"),
    status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
    tags: json("tags").$type<string[]>(),
    notes: text("notes"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    lastContactAt: timestamp("lastContactAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("customer_org_idx").on(table.organizationId),
    emailIdx: index("customer_email_idx").on(table.email),
    phoneIdx: index("customer_phone_idx").on(table.phone),
    nameIdx: index("customer_name_idx").on(table.firstName, table.lastName),
  })
);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Leads ──────────────────────────────────────────────────────────────
export const leads = mysqlTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: bigint("customerId", { mode: "number", unsigned: true }).references(() => customers.id, {
      onDelete: "set null",
    }),
    firstName: varchar("firstName", { length: 255 }).notNull(),
    lastName: varchar("lastName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    source: mysqlEnum("source", [
      "ai_call",
      "ai_chat",
      "website_form",
      "phone",
      "sms",
      "email",
      "referral",
      "social_media",
      "paid_ad",
      "event",
      "other",
    ]).default("other"),
    status: mysqlEnum("status", [
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
      "archived",
    ])
      .default("new")
      .notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
    estimatedValue: int("estimatedValue"),
    assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    tags: json("tags").$type<string[]>(),
    notes: text("notes"),
    customFields: json("customFields").$type<Record<string, unknown>>(),
    lastActivityAt: timestamp("lastActivityAt"),
    convertedAt: timestamp("convertedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("lead_org_idx").on(table.organizationId),
    statusIdx: index("lead_status_idx").on(table.status),
    assignedIdx: index("lead_assigned_idx").on(table.assignedTo),
    customerIdx: index("lead_customer_idx").on(table.customerId),
    sourceIdx: index("lead_source_idx").on(table.source),
    emailIdx: index("lead_email_idx").on(table.email),
    phoneIdx: index("lead_phone_idx").on(table.phone),
  })
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Conversations ───────────────────────────────────────────────────────
export const conversations = mysqlTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: bigint("customerId", { mode: "number", unsigned: true }).references(() => customers.id, {
      onDelete: "set null",
    }),
    leadId: bigint("leadId", { mode: "number", unsigned: true }).references(() => leads.id, {
      onDelete: "set null",
    }),
    channel: mysqlEnum("channel", ["sms", "email", "web_chat", "phone", "ai_chat", "whatsapp"]).notNull(),
    subject: varchar("subject", { length: 500 }),
    status: mysqlEnum("status", ["open", "closed", "pending", "spam"]).default("open").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
    assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    aiHandled: boolean("aiHandled").default(false),
    aiSummary: text("aiSummary"),
    lastMessageAt: timestamp("lastMessageAt"),
    lastMessagePreview: text("lastMessagePreview"),
    messageCount: int("messageCount").default(0),
    unreadCount: int("unreadCount").default(0),
    tags: json("tags").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("conv_org_idx").on(table.organizationId),
    customerIdx: index("conv_customer_idx").on(table.customerId),
    leadIdx: index("conv_lead_idx").on(table.leadId),
    statusIdx: index("conv_status_idx").on(table.status),
    assignedIdx: index("conv_assigned_idx").on(table.assignedTo),
    channelIdx: index("conv_channel_idx").on(table.channel),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ─── Messages ────────────────────────────────────────────────────────────
export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderType: mysqlEnum("senderType", ["customer", "agent", "ai", "system"]).notNull(),
    senderId: bigint("senderId", { mode: "number", unsigned: true }),
    content: text("content").notNull(),
    contentType: mysqlEnum("contentType", ["text", "html", "image", "file", "audio", "video"]).default("text"),
    attachments: json("attachments").$type<Array<{ name: string; url: string; type: string; size: number }>>(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    isInternalNote: boolean("isInternalNote").default(false),
    editedAt: timestamp("editedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("msg_conv_idx").on(table.conversationId),
    senderIdx: index("msg_sender_idx").on(table.senderId),
    createdIdx: index("msg_created_idx").on(table.createdAt),
  })
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Calls ───────────────────────────────────────────────────────────────
export const calls = mysqlTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: bigint("customerId", { mode: "number", unsigned: true }).references(() => customers.id, {
      onDelete: "set null",
    }),
    leadId: bigint("leadId", { mode: "number", unsigned: true }).references(() => leads.id, {
      onDelete: "set null",
    }),
    phoneNumber: varchar("phoneNumber", { length: 50 }).notNull(),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
    status: mysqlEnum("status", ["queued", "ringing", "in_progress", "completed", "missed", "voicemail", "failed", "busy", "no_answer"])
      .default("queued")
      .notNull(),
    duration: int("duration"),
    recordingUrl: text("recordingUrl"),
    recordingDuration: int("recordingDuration"),
    transcript: text("transcript"),
    transcriptStatus: mysqlEnum("transcriptStatus", ["pending", "processing", "completed", "failed"]).default("pending"),
    aiHandled: boolean("aiHandled").default(false),
    aiSummary: text("aiSummary"),
    userId: bigint("userId", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    startedAt: timestamp("startedAt"),
    endedAt: timestamp("endedAt"),
    cost: int("cost"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("call_org_idx").on(table.organizationId),
    customerIdx: index("call_customer_idx").on(table.customerId),
    phoneIdx: index("call_phone_idx").on(table.phoneNumber),
    statusIdx: index("call_status_idx").on(table.status),
    directionIdx: index("call_direction_idx").on(table.direction),
    createdIdx: index("call_created_idx").on(table.createdAt),
  })
);

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// ─── Appointments ────────────────────────────────────────────────────────
export const appointments = mysqlTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: bigint("customerId", { mode: "number", unsigned: true }).references(() => customers.id, {
      onDelete: "set null",
    }),
    leadId: bigint("leadId", { mode: "number", unsigned: true }).references(() => leads.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 500 }),
    startTime: timestamp("startTime").notNull(),
    endTime: timestamp("endTime").notNull(),
    status: mysqlEnum("status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"])
      .default("scheduled")
      .notNull(),
    type: mysqlEnum("type", ["call", "meeting", "demo", "follow_up", "consultation", "other"]).default("meeting"),
    assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    reminderSent: boolean("reminderSent").default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("appt_org_idx").on(table.organizationId),
    customerIdx: index("appt_customer_idx").on(table.customerId),
    startIdx: index("appt_start_idx").on(table.startTime),
    assignedIdx: index("appt_assigned_idx").on(table.assignedTo),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ─── Tasks ───────────────────────────────────────────────────────────────
export const tasks = mysqlTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: bigint("customerId", { mode: "number", unsigned: true }).references(() => customers.id, {
      onDelete: "set null",
    }),
    leadId: bigint("leadId", { mode: "number", unsigned: true }).references(() => leads.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    type: mysqlEnum("type", ["follow_up", "call", "email", "meeting", "demo", "reminder", "other"]).default("follow_up"),
    status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled", "overdue"]).default("pending").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
    assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("dueDate"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("task_org_idx").on(table.organizationId),
    assignedIdx: index("task_assigned_idx").on(table.assignedTo),
    statusIdx: index("task_status_idx").on(table.status),
    dueIdx: index("task_due_idx").on(table.dueDate),
  })
);

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Automations ─────────────────────────────────────────────────────────
export const automations = mysqlTable(
  "automations",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    trigger: mysqlEnum("trigger", [
      "lead_created",
      "lead_status_changed",
      "conversation_started",
      "call_completed",
      "appointment_scheduled",
      "task_due",
      "no_response",
      "follow_up_needed",
      "manual",
    ]).notNull(),
    conditions: json("conditions").$type<Record<string, unknown>[]>(),
    actions: json("actions").$type<Record<string, unknown>[]>(),
    status: mysqlEnum("status", ["active", "paused", "draft"]).default("draft").notNull(),
    runCount: int("runCount").default(0),
    lastRunAt: timestamp("lastRunAt"),
    createdBy: bigint("createdBy", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("auto_org_idx").on(table.organizationId),
    triggerIdx: index("auto_trigger_idx").on(table.trigger),
    statusIdx: index("auto_status_idx").on(table.status),
  })
);

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

// ─── Subscriptions ───────────────────────────────────────────────────────
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).notNull(),
    status: mysqlEnum("status", ["trialing", "active", "past_due", "cancelled", "paused"]).default("trialing").notNull(),
    stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
    minutesIncluded: int("minutesIncluded").default(100),
    minutesUsed: int("minutesUsed").default(0),
    leadsLimit: int("leadsLimit").default(100),
    usersLimit: int("usersLimit").default(2),
    features: json("features").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: uniqueIndex("sub_org_idx").on(table.organizationId),
  })
);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ─── Knowledge Base ──────────────────────────────────────────────────────
export const knowledgeBase = mysqlTable(
  "knowledgeBase",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["faq", "service", "pricing", "policy", "product", "script", "general"]).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    category: varchar("category", { length: 255 }),
    tags: json("tags").$type<string[]>(),
    aiEnabled: boolean("aiEnabled").default(true),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdBy: bigint("createdBy", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    orgIdx: index("kb_org_idx").on(table.organizationId),
    typeIdx: index("kb_type_idx").on(table.type),
  })
);

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;

// ─── Activities (audit log / timeline) ───────────────────────────────────
export const activities = mysqlTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    organizationId: bigint("organizationId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: bigint("actorId", { mode: "number", unsigned: true }),
    actorType: mysqlEnum("actorType", ["user", "system", "ai", "customer"]).default("user").notNull(),
    entityType: mysqlEnum("entityType", ["lead", "customer", "conversation", "call", "appointment", "task", "automation", "organization", "user"]).notNull(),
    entityId: bigint("entityId", { mode: "number", unsigned: true }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("act_org_idx").on(table.organizationId),
    entityIdx: index("act_entity_idx").on(table.entityType, table.entityId),
    createdIdx: index("act_created_idx").on(table.createdAt),
  })
);

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;
