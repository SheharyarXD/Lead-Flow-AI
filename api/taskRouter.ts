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
import { requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";
import { createActivity } from "./queries/activities";

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
    .query(async ({ input, ctx }) => { await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findTasksByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => { const task = await findTaskById(input.id); if (!task) return null; await requireOrganizationMembership(ctx.user.id, task.organizationId); return task;
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
    .mutation(async ({ input, ctx }) => { await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
      const task = await createTask({
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
      if (task) {
        await createActivity({
          organizationId: input.organizationId,
          actorId: ctx.user.id,
          actorType: "user",
          entityType: "task",
          entityId: task.id,
          action: "Task created",
          description: `Task "${task.title}" created`,
        });
      }
      return task;
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const task = await findTaskById(id); if (!task) return null; await requireOrganizationRole(ctx.user.id, task.organizationId, ["owner", "admin", "manager", "member"]);
      const updated = await updateTask(id, task.organizationId, data as Record<string, unknown>);
      await createActivity({
        organizationId: task.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "task",
        entityId: id,
        action: data.status === "completed" ? "Task completed" : "Task updated",
        description: `Task "${task.title}" ${data.status === "completed" ? "marked completed" : "updated"}`,
      });
      return updated;
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => { const task = await findTaskById(input.id); if (!task) return { success: true }; await requireOrganizationRole(ctx.user.id, task.organizationId, ["owner", "admin", "manager"]);
      await deleteTask(input.id, task.organizationId);
      await createActivity({
        organizationId: task.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "task",
        entityId: input.id,
        action: "Task deleted",
        description: `Task "${task.title}" deleted`,
      });
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => { await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getTaskStats(input.organizationId);
    }),
});
