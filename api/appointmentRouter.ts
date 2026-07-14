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
import { requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";
import { createActivity } from "./queries/activities";

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
      const appt = await createAppointment({
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
      if (appt) {
        await createActivity({
          organizationId: input.organizationId,
          actorId: ctx.user.id,
          actorType: "user",
          entityType: "appointment",
          entityId: appt.id,
          action: "Appointment scheduled",
          description: `"${appt.title}" scheduled for ${new Date(appt.startTime).toLocaleString()}`,
        });
      }
      return appt;
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
      const updated = await updateAppointment(id, appt.organizationId, data as Record<string, unknown>);
      const isReschedule = data.startTime !== undefined || data.endTime !== undefined;
      await createActivity({
        organizationId: appt.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "appointment",
        entityId: id,
        action: isReschedule ? "Appointment rescheduled" : "Appointment updated",
        description: `"${appt.title}" ${isReschedule ? "rescheduled" : "updated"}`,
      });
      return updated;
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const appt = await findAppointmentById(input.id);
      if (!appt) return { success: true };
      await requireOrganizationRole(ctx.user.id, appt.organizationId, ["owner", "admin", "manager"]);
      await deleteAppointment(input.id, appt.organizationId);
      await createActivity({
        organizationId: appt.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "appointment",
        entityId: input.id,
        action: "Appointment cancelled",
        description: `"${appt.title}" cancelled`,
      });
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getAppointmentStats(input.organizationId);
    }),
});
