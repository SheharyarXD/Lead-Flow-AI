import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { eq } from "drizzle-orm";
import { subscriptions } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  findOrganizationById,
  findUserOrganizations,
  findOrganizationMembers,
  createOrganization,
  updateOrganization,
  addOrganizationMember,
  createSubscription,
  findUserDefaultOrganization,
  requireOrganizationMembership,
  requireOrganizationRole,
} from "./queries/organizations";
import { createKBEntry } from "./queries/knowledgeBase";

export const organizationRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    return findUserOrganizations(ctx.user.id);
  }),

  getDefaultSubscription: authedQuery.query(async ({ ctx }) => {
    const defaultOrg = await findUserDefaultOrganization(ctx.user.id);
    if (!defaultOrg) return null;
    return getDb().query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, defaultOrg.id),
    });
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.id);
      return findOrganizationById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        industry: z.string().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await createOrganization({
        name: input.name,
        slug: input.slug,
        industry: input.industry,
        website: input.website,
        phone: input.phone,
        email: input.email,
        address: input.address,
        timezone: input.timezone ?? "America/New_York",
      });

      if (org) {
        await addOrganizationMember({
          organizationId: org.id,
          userId: ctx.user.id,
          role: "owner",
          isDefault: true,
        });

        await createSubscription({
          organizationId: org.id,
          plan: "starter",
          status: "trialing",
          minutesIncluded: 100,
          leadsLimit: 100,
          usersLimit: 2,
        });
      }

      return org;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
        businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
        aiEnabled: z.boolean().optional(),
        aiInstructions: z.string().optional(),
        greetingMessage: z.string().optional(),
        openaiApiKey: z.string().nullable().optional(),
        twilioAccountSid: z.string().nullable().optional(),
        twilioAuthToken: z.string().nullable().optional(),
        twilioPhoneNumber: z.string().nullable().optional(),
        smtpHost: z.string().nullable().optional(),
        smtpPort: z.number().nullable().optional(),
        smtpUser: z.string().nullable().optional(),
        smtpPass: z.string().nullable().optional(),
        smtpFromEmail: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await requireOrganizationRole(ctx.user.id, id, ["owner", "admin", "manager"]);
      return updateOrganization(id, data as Record<string, unknown>);
    }),

  members: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return findOrganizationMembers(input.organizationId);
    }),

  completeOnboarding: authedQuery
    .input(z.object({
      organizationId: z.number(),
      name: z.string().min(1),
      industry: z.string().min(1),
      phone: z.string().min(3),
      businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })),
      services: z.array(z.string().min(1)).max(50),
      faqs: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).max(50),
      aiInstructions: z.string().max(10000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const organization = await updateOrganization(input.organizationId, {
        name: input.name,
        industry: input.industry,
        phone: input.phone,
        businessHours: input.businessHours,
        services: input.services,
        aiInstructions: input.aiInstructions,
        onboardingCompletedAt: new Date(),
      });
      for (const faq of input.faqs) {
        await createKBEntry({ organizationId: input.organizationId, type: "faq", title: faq.question, content: faq.answer, createdBy: ctx.user.id, aiEnabled: true });
      }
      return organization;
    }),
});
