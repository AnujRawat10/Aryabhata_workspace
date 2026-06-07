import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireOrgOwner, requireProjectMember, requireProjectOwner } from "~/server/api/authz";

export const projectRouter = createTRPCRouter({
  // List projects in an org that the current user is a member of.
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.project.findMany({
        where: {
          organizationId: input.organizationId,
          members: { some: { userId: ctx.session.user.id } },
        },
        include: { _count: { select: { articles: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Only ORG OWNERS can create projects. The creator becomes the project OWNER.
  create: protectedProcedure
    .input(z.object({ organizationId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgOwner(ctx.db, ctx.session.user.id, input.organizationId);
      return ctx.db.project.create({
        data: {
          name: input.name.trim(),
          organizationId: input.organizationId,
          members: { create: { userId: ctx.session.user.id, role: "OWNER" } },
        },
      });
    }),

  // Fetch a single project; only members may read it.
  getById: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await requireProjectMember(ctx.db, ctx.session.user.id, input.projectId);
      const project = await ctx.db.project.findUnique({
        where: { id: input.projectId },
        include: { organization: true, _count: { select: { articles: true } } },
      });
      return { ...project!, viewerRole: membership.role };
    }),

  // List members of a project. Any project member may view the roster.
  listMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, ctx.session.user.id, input.projectId);
      const members = await ctx.db.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { role: "asc" },
      });
      return members.map((m) => ({ id: m.id, role: m.role, user: m.user }));
    }),

  // Only project owners can add members.
  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        email: z.string().email(),
        role: z.enum(["OWNER", "REVIEWER"]).default("REVIEWER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, ctx.session.user.id, input.projectId);
      const user = await ctx.db.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
      if (!user) throw new Error("No user with that email.");
      return ctx.db.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: input.projectId } },
        update: { role: input.role },
        create: { userId: user.id, projectId: input.projectId, role: input.role },
      });
    }),
});
