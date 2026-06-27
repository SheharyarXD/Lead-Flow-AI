import { relations } from "drizzle-orm";
import {
  users,
  organizations,
  organizationMembers,
  customers,
  leads,
  conversations,
  messages,
  calls,
  appointments,
  tasks,
  automations,
  subscriptions,
  knowledgeBase,
  activities,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  assignedLeads: many(leads, { relationName: "assignedLeads" }),
  assignedConversations: many(conversations, { relationName: "assignedConversations" }),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  assignedAppointments: many(appointments, { relationName: "assignedAppointments" }),
  assignedCalls: many(calls, { relationName: "assignedCalls" }),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  customers: many(customers),
  leads: many(leads),
  conversations: many(conversations),
  calls: many(calls),
  appointments: many(appointments),
  tasks: many(tasks),
  automations: many(automations),
  subscription: one(subscriptions, { fields: [organizations.id], references: [subscriptions.organizationId] }),
  knowledgeBase: many(knowledgeBase),
  activities: many(activities),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const customersRelations = relations(customers, ({ many, one }) => ({
  organization: one(organizations, { fields: [customers.organizationId], references: [organizations.id] }),
  leads: many(leads),
  conversations: many(conversations),
  calls: many(calls),
  appointments: many(appointments),
  tasks: many(tasks),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, { fields: [leads.organizationId], references: [organizations.id] }),
  customer: one(customers, { fields: [leads.customerId], references: [customers.id] }),
  assignedUser: one(users, { fields: [leads.assignedTo], references: [users.id], relationName: "assignedLeads" }),
  conversations: many(conversations),
  calls: many(calls),
  tasks: many(tasks),
  appointments: many(appointments),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, { fields: [conversations.organizationId], references: [organizations.id] }),
  customer: one(customers, { fields: [conversations.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  assignedUser: one(users, { fields: [conversations.assignedTo], references: [users.id], relationName: "assignedConversations" }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  organization: one(organizations, { fields: [calls.organizationId], references: [organizations.id] }),
  customer: one(customers, { fields: [calls.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [calls.leadId], references: [leads.id] }),
  assignedUser: one(users, { fields: [calls.userId], references: [users.id], relationName: "assignedCalls" }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  organization: one(organizations, { fields: [appointments.organizationId], references: [organizations.id] }),
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [appointments.leadId], references: [leads.id] }),
  assignedUser: one(users, { fields: [appointments.assignedTo], references: [users.id], relationName: "assignedAppointments" }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, { fields: [tasks.organizationId], references: [organizations.id] }),
  customer: one(customers, { fields: [tasks.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
  assignedUser: one(users, { fields: [tasks.assignedTo], references: [users.id], relationName: "assignedTasks" }),
}));

export const automationsRelations = relations(automations, ({ one }) => ({
  organization: one(organizations, { fields: [automations.organizationId], references: [organizations.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, { fields: [subscriptions.organizationId], references: [organizations.id] }),
}));

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  organization: one(organizations, { fields: [knowledgeBase.organizationId], references: [organizations.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  organization: one(organizations, { fields: [activities.organizationId], references: [organizations.id] }),
}));
