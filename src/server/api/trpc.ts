/**
 * tRPC initialization: context, transformer, and the procedure helpers that
 * enforce authorization. Every router builds on the procedures defined here.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Context available to every procedure. We attach the Prisma client and the
 * (possibly null) session.
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await getServerAuthSession();
  return { db, session, headers: opts.headers };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires a logged-in user. Narrows `ctx.session` to non-null downstream. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return next({ ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } } });
});
