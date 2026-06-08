import { z } from "zod";
import { type Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireProjectMember, requireProjectOwner } from "~/server/api/authz";
import { parseArticles } from "~/server/import/parseArticles";

const PAGE_SIZE = 25;

// Columns the table is allowed to sort by (decision/notes are per-user and omitted).
const SORT_FIELDS = ["title", "firstAuthor", "journal", "publicationYear", "createdAt"] as const;

const decisionFilter = z.array(z.enum(["INCLUDE", "EXCLUDE", "MAYBE", "UNREVIEWED"])).optional();

// Shared filter shape used by both `list` and `export`.
const filterInput = z.object({
  projectId: z.string(),
  search: z.string().optional(),
  decisions: decisionFilter,
  yearMin: z.number().int().optional(),
  yearMax: z.number().int().optional(),
  sortBy: z.enum(SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

/** Build the Prisma `where` clause from the filters (kept in one place so list + export agree). */
function buildWhere(
  userId: string,
  input: z.infer<typeof filterInput>,
): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = { projectId: input.projectId };

  if (input.search?.trim()) {
    const q = input.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { authors: { contains: q, mode: "insensitive" } },
      { journal: { contains: q, mode: "insensitive" } },
    ];
  }

  if (input.yearMin !== undefined || input.yearMax !== undefined) {
    where.publicationYear = {
      ...(input.yearMin !== undefined ? { gte: input.yearMin } : {}),
      ...(input.yearMax !== undefined ? { lte: input.yearMax } : {}),
    };
  }

  if (input.decisions && input.decisions.length > 0) {
    const buckets: Prisma.ArticleWhereInput[] = [];
    const concrete = input.decisions.filter((d) => d !== "UNREVIEWED") as (
      | "INCLUDE"
      | "EXCLUDE"
      | "MAYBE"
    )[];
    if (concrete.length > 0) {
      buckets.push({ reviewDecisions: { some: { userId, decision: { in: concrete } } } });
    }
    if (input.decisions.includes("UNREVIEWED")) {
      buckets.push({ reviewDecisions: { none: { userId } } });
    }
    where.AND = [{ OR: buckets }];
  }

  return where;
}

export const articleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(filterInput.extend({ page: z.number().int().min(1).default(1) }))
    .query(async ({ ctx, input }) => {
      // AUTHZ: only project members can list articles.
      await requireProjectMember(ctx.db, ctx.session.user.id, input.projectId);
      const userId = ctx.session.user.id;
      const where = buildWhere(userId, input);

      const [total, articles] = await ctx.db.$transaction([
        ctx.db.article.count({ where }),
        ctx.db.article.findMany({
          where,
          orderBy: { [input.sortBy]: input.sortDir },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          // Attach only THIS user's decision so the table shows their review state.
          include: { reviewDecisions: { where: { userId }, include: { user: true } } },
        }),
      ]);

      const items = articles.map((a) => {
        const mine = a.reviewDecisions[0];
        return {
          id: a.id,
          title: a.title,
          firstAuthor: a.firstAuthor,
          journal: a.journal,
          publicationYear: a.publicationYear,
          decision: mine?.decision ?? null,
          notes: mine?.notes ?? null,
        };
      });

      return { items, total, page: input.page, pageSize: PAGE_SIZE };
    }),

  // Return every article matching the current filters (no pagination) for CSV export.
  export: protectedProcedure.input(filterInput).query(async ({ ctx, input }) => {
    await requireProjectMember(ctx.db, ctx.session.user.id, input.projectId);
    const userId = ctx.session.user.id;
    const where = buildWhere(userId, input);

    const articles = await ctx.db.article.findMany({
      where,
      orderBy: { [input.sortBy]: input.sortDir },
      include: { reviewDecisions: { where: { userId } } },
    });

    return articles.map((a) => ({
      pmid: a.pmid,
      title: a.title,
      authors: a.authors,
      firstAuthor: a.firstAuthor,
      journal: a.journal,
      publicationYear: a.publicationYear,
      doi: a.doi,
      decision: a.reviewDecisions[0]?.decision ?? null,
      notes: a.reviewDecisions[0]?.notes ?? null,
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ articleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.article.findUnique({
        where: { id: input.articleId },
        include: { reviewDecisions: { include: { user: true }, orderBy: { updatedAt: "desc" } } },
      });
      if (!article) throw new Error("Article not found.");
      // AUTHZ: must be a member of the project this article belongs to.
      await requireProjectMember(ctx.db, ctx.session.user.id, article.projectId);

      const myDecision = article.reviewDecisions.find((r) => r.userId === ctx.session.user.id);
      const lastReviewed = article.reviewDecisions[0]; // most recent across all users
      return {
        ...article,
        myDecision: myDecision ?? null,
        lastReviewedBy: lastReviewed
          ? { name: lastReviewed.user.name ?? lastReviewed.user.email, at: lastReviewed.updatedAt }
          : null,
      };
    }),

  // Import accepts already-extracted rows (the browser reads the .xlsx with the
  // `xlsx` package and posts plain JSON). Validation + persistence happen here,
  // server-side, inside a transaction. Only PROJECT OWNERS may import.
  import: protectedProcedure
    .input(z.object({ projectId: z.string(), rows: z.array(z.record(z.any())) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, ctx.session.user.id, input.projectId);

      // Existing identifiers for in-project duplicate detection.
      const existing = await ctx.db.article.findMany({
        where: { projectId: input.projectId },
        select: { pmid: true, doi: true },
      });
      const existingPmids = new Set(existing.map((e) => e.pmid));
      const existingDois = new Set(existing.map((e) => e.doi).filter((d): d is string => !!d));

      const result = parseArticles(input.rows, existingPmids, existingDois);

      // Persist atomically: either all valid rows import, or none do.
      await ctx.db.$transaction(
        result.imported.map((a) =>
          ctx.db.article.create({
            data: {
              projectId: input.projectId,
              pmid: a.pmid,
              title: a.title,
              authors: a.authors,
              citation: a.citation,
              firstAuthor: a.firstAuthor,
              journal: a.journal,
              publicationYear: a.publicationYear,
              createDate: a.createDate,
              pmcid: a.pmcid,
              nihmsId: a.nihmsId,
              doi: a.doi,
            },
          }),
        ),
      );

      // Return a summary for the modal.
      return {
        total: result.total,
        importedCount: result.imported.length,
        skipped: result.skipped,
        warnings: result.imported
          .filter((a) => a.warnings.length > 0)
          .map((a) => ({ pmid: a.pmid, title: a.title, flags: a.warnings })),
      };
    }),
});
