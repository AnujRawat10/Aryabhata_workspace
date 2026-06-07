import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireOrgMember, requireOrgOwner } from "~/server/api/authz";

export const organizationRouter = createTRPCRouter({
  // List organizations the current user belongs to, with their projects.
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.organizationMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        organization: {
          include: {
            projects: {
              // Only include projects the user is also a member of.
              where: { members: { some: { userId: ctx.session.user.id } } },
              include: { _count: { select: { articles: true } } },
            },
          },
        },
      },
    });
    return memberships.map((m) => ({ role: m.role, organization: m.organization }));
  }),

  // List members of an org. Any member may view the roster.
  listMembers: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOrgMember(ctx.db, ctx.session.user.id, input.organizationId);
      const members = await ctx.db.organizationMember.findMany({
        where: { organizationId: input.organizationId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { role: "asc" },
      });
      return members.map((m) => ({ id: m.id, role: m.role, user: m.user }));
    }),

  // Any signed-in user can create an org; they become its OWNER.
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.organization.create({
        data: {
          name: input.name.trim(),
          members: { create: { userId: ctx.session.user.id, role: "OWNER" } },
        },
      });
    }),

  // Only org owners can add members.
  addMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgOwner(ctx.db, ctx.session.user.id, input.organizationId);
      const user = await ctx.db.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
      if (!user) throw new Error("No user with that email.");
      return ctx.db.organizationMember.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: input.organizationId } },
        update: { role: input.role },
        create: { userId: user.id, organizationId: input.organizationId, role: input.role },
      });
    }),
});
