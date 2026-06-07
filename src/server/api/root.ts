import { createTRPCRouter } from "~/server/api/trpc";
import { authRouter } from "~/server/api/routers/auth";
import { organizationRouter } from "~/server/api/routers/organization";
import { projectRouter } from "~/server/api/routers/project";
import { articleRouter } from "~/server/api/routers/article";
import { reviewRouter } from "~/server/api/routers/review";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  organization: organizationRouter,
  project: projectRouter,
  article: articleRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
