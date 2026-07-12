import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { appointments } from "@db/schema";
import {
  findAppointmentsByOrganization,
  findAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentStats,
} from "./queries/appointments";
import { requireOrganizationMembership, requireOrganizationRole } from "./queries/organizations";

export const appointmentRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        assignedTo: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findAppointmentsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const appt = await findAppointmentById(input.id);
      if (!appt) return null;
      await requireOrganizationMembership(ctx.user.id, appt.organizationId);
      return appt;
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
        type: z.string().optional(),
        assignedTo: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
      return createAppointment({
        organizationId: input.organizationId,
        customerId: input.customerId,
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        location: input.location,
        startTime: input.startTime,
        endTime: input.endTime,
        type: (input.type as typeof appointments.$inferSelect.type) ?? "meeting",
        assignedTo: input.assignedTo,
        notes: input.notes,
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        assignedTo: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const appt = await findAppointmentById(id);
      if (!appt) throw new Error("Appointment not found");
      await requireOrganizationRole(ctx.user.id, appt.organizationId, ["owner", "admin", "manager", "member"]);
      return updateAppointment(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const appt = await findAppointmentById(input.id);
      if (!appt) return { success: true };
      await requireOrganizationRole(ctx.user.id, appt.organizationId, ["owner", "admin", "manager"]);
      await deleteAppointment(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getAppointmentStats(input.organizationId);
    }),
});
