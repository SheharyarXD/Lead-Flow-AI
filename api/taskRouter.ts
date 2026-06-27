import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { tasks } from "@db/schema";
import {
  findTasksByOrganization,
  findTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
} from "./queries/tasks";

export const taskRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedTo: z.number().optional(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findTasksByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findTaskById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedTo: z.number().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createTask({
        organizationId: input.organizationId,
        customerId: input.customerId,
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        type: (input.type as typeof tasks.$inferSelect.type) ?? "follow_up",
        status: (input.status as typeof tasks.$inferSelect.status) ?? "pending",
        priority: (input.priority as typeof tasks.$inferSelect.priority) ?? "medium",
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedTo: z.number().optional(),
        dueDate: z.date().optional(),
        completedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateTask(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTask(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getTaskStats(input.organizationId);
    }),
});
