/**
 * Server-side authorization helpers, reused by every router.
 *
 * Authorization is ALWAYS enforced here, never by hiding UI. Each helper throws
 * a TRPCError if the user lacks the required membership/role.
 */
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

/** Throws unless the user is a member of the organization. Returns the membership. */
export async function requireOrgMember(db: PrismaClient, userId: string, organizationId: string) {
  const membership = await db.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization." });
  }
  return membership;
}

/** Throws unless the user is an OWNER of the organization. */
export async function requireOrgOwner(db: PrismaClient, userId: string, organizationId: string) {
  const membership = await requireOrgMember(db, userId, organizationId);
  if (membership.role !== "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only organization owners can do this." });
  }
  return membership;
}

/** Throws unless the user is a member of the project. Returns the membership. */
export async function requireProjectMember(db: PrismaClient, userId: string, projectId: string) {
  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this project." });
  }
  return membership;
}

/** Throws unless the user is an OWNER of the project. */
export async function requireProjectOwner(db: PrismaClient, userId: string, projectId: string) {
  const membership = await requireProjectMember(db, userId, projectId);
  if (membership.role !== "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only project owners can do this." });
  }
  return membership;
}
