import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireProjectMember } from "~/server/api/authz";

/** Loads an article and asserts the caller is a member of its project. */
async function assertCanReview(
  db: Parameters<typeof requireProjectMember>[0],
  userId: string,
  articleId: string,
) {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { id: true, projectId: true },
  });
  if (!article) throw new Error("Article not found.");
  await requireProjectMember(db, userId, article.projectId);
  return article;
}

export const reviewRouter = createTRPCRouter({
  // Set this user's decision and/or notes for an article (one row per user).
  // If no decision row exists yet and only notes are supplied, the decision
  // defaults to MAYBE (writing notes implies the article is under consideration).
  setDecision: protectedProcedure
    .input(
      z.object({
        articleId: z.string(),
        decision: z.enum(["INCLUDE", "EXCLUDE", "MAYBE"]).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanReview(ctx.db, ctx.session.user.id, input.articleId);
      return ctx.db.reviewDecision.upsert({
        where: { articleId_userId: { articleId: input.articleId, userId: ctx.session.user.id } },
        update: {
          ...(input.decision !== undefined ? { decision: input.decision } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        create: {
          articleId: input.articleId,
          userId: ctx.session.user.id,
          decision: input.decision ?? "MAYBE",
          notes: input.notes ?? null,
        },
      });
    }),

  // Set the same decision for many articles at once (bulk action).
  setDecisionBulk: protectedProcedure
    .input(
      z.object({
        articleIds: z.array(z.string()).min(1),
        decision: z.enum(["INCLUDE", "EXCLUDE", "MAYBE"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Authorize each article's project membership before writing.
      for (const id of input.articleIds) {
        await assertCanReview(ctx.db, ctx.session.user.id, id);
      }
      await ctx.db.$transaction(
        input.articleIds.map((articleId) =>
          ctx.db.reviewDecision.upsert({
            where: { articleId_userId: { articleId, userId: ctx.session.user.id } },
            update: { decision: input.decision },
            create: { articleId, userId: ctx.session.user.id, decision: input.decision },
          }),
        ),
      );
      return { count: input.articleIds.length };
    }),

  // Get the current user's decision for one article.
  getDecision: protectedProcedure
    .input(z.object({ articleId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReview(ctx.db, ctx.session.user.id, input.articleId);
      return ctx.db.reviewDecision.findUnique({
        where: { articleId_userId: { articleId: input.articleId, userId: ctx.session.user.id } },
      });
    }),

  // List every reviewer's decision for an article.
  listByArticle: protectedProcedure
    .input(z.object({ articleId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReview(ctx.db, ctx.session.user.id, input.articleId);
      return ctx.db.reviewDecision.findMany({
        where: { articleId: input.articleId },
        include: { user: true },
        orderBy: { updatedAt: "desc" },
      });
    }),
});
