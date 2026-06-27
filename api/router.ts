import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { organizationRouter } from "./organizationRouter";
import { leadRouter } from "./leadRouter";
import { customerRouter } from "./customerRouter";
import { conversationRouter } from "./conversationRouter";
import { callRouter } from "./callRouter";
import { appointmentRouter } from "./appointmentRouter";
import { taskRouter } from "./taskRouter";
import { automationRouter } from "./automationRouter";
import { dashboardRouter } from "./dashboardRouter";
import { activityRouter } from "./activityRouter";
import { knowledgeBaseRouter } from "./knowledgeBaseRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  organization: organizationRouter,
  lead: leadRouter,
  customer: customerRouter,
  conversation: conversationRouter,
  calls: callRouter,
  appointment: appointmentRouter,
  task: taskRouter,
  automation: automationRouter,
  dashboard: dashboardRouter,
  activity: activityRouter,
  knowledgeBase: knowledgeBaseRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
