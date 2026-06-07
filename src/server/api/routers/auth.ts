import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const authRouter = createTRPCRouter({
  // Registration is a tRPC mutation. Actual login is handled by NextAuth's
  // credentials provider (see src/server/auth.ts) via signIn() on the client.
  register: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Name is required"),
        // .trim() so stray spaces from autofill/paste don't fail validation.
        email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();
      const existing = await ctx.db.user.findUnique({ where: { email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists." });
      }
      const password = await bcrypt.hash(input.password, 10);
      const user = await ctx.db.user.create({
        data: { name: input.name.trim(), email, password },
      });
      return { id: user.id, email: user.email };
    }),
});
