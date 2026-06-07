import { describe, it, expect, vi } from "vitest";
import { appRouter } from "../src/server/api/root";

/**
 * These tests exercise the tRPC procedures with a hand-rolled mock Prisma client
 * so we can assert (a) authorization is enforced and (b) filters/sort map to the
 * correct Prisma query — without needing a live database.
 */

type Membership = { role: "OWNER" | "REVIEWER" } | null;

function makeCaller(opts: {
  userId?: string;
  membership?: Membership;
  findManyCapture?: (args: any) => void;
}) {
  const db: any = {
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(opts.membership ?? null),
    },
    article: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockImplementation((args: any) => {
        opts.findManyCapture?.(args);
        return Promise.resolve([]);
      }),
    },
    // Our router calls $transaction([count, findMany]); resolve them together.
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const ctx: any = {
    db,
    session: opts.userId ? { user: { id: opts.userId } } : null,
    headers: new Headers(),
  };
  return { caller: appRouter.createCaller(ctx), db };
}

describe("authorization", () => {
  it("rejects an unauthenticated user with UNAUTHORIZED", async () => {
    const { caller } = makeCaller({});
    await expect(caller.article.list({ projectId: "p1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a user who is not a member of the project with FORBIDDEN", async () => {
    // membership lookup returns null -> not a member.
    const { caller } = makeCaller({ userId: "u1", membership: null });
    await expect(caller.article.list({ projectId: "p1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a project member to list articles", async () => {
    const { caller } = makeCaller({ userId: "u1", membership: { role: "REVIEWER" } });
    const res = await caller.article.list({ projectId: "p1" });
    expect(res).toMatchObject({ items: [], total: 0, page: 1, pageSize: 25 });
  });
});

describe("article.list filters & sort", () => {
  it("builds a case-insensitive search OR across title/authors/journal", async () => {
    let captured: any;
    const { caller } = makeCaller({
      userId: "u1",
      membership: { role: "REVIEWER" },
      findManyCapture: (a) => (captured = a),
    });
    await caller.article.list({ projectId: "p1", search: "cancer" });
    expect(captured.where.OR).toEqual([
      { title: { contains: "cancer", mode: "insensitive" } },
      { authors: { contains: "cancer", mode: "insensitive" } },
      { journal: { contains: "cancer", mode: "insensitive" } },
    ]);
  });

  it("maps a year range to publicationYear gte/lte", async () => {
    let captured: any;
    const { caller } = makeCaller({
      userId: "u1",
      membership: { role: "REVIEWER" },
      findManyCapture: (a) => (captured = a),
    });
    await caller.article.list({ projectId: "p1", yearMin: 2000, yearMax: 2010 });
    expect(captured.where.publicationYear).toEqual({ gte: 2000, lte: 2010 });
  });

  it("filters by decision buckets including UNREVIEWED", async () => {
    let captured: any;
    const { caller } = makeCaller({
      userId: "u1",
      membership: { role: "REVIEWER" },
      findManyCapture: (a) => (captured = a),
    });
    await caller.article.list({ projectId: "p1", decisions: ["INCLUDE", "UNREVIEWED"] });
    const orBuckets = captured.where.AND[0].OR;
    expect(orBuckets).toContainEqual({
      reviewDecisions: { some: { userId: "u1", decision: { in: ["INCLUDE"] } } },
    });
    expect(orBuckets).toContainEqual({ reviewDecisions: { none: { userId: "u1" } } });
  });

  it("applies the requested sort column and direction", async () => {
    let captured: any;
    const { caller } = makeCaller({
      userId: "u1",
      membership: { role: "REVIEWER" },
      findManyCapture: (a) => (captured = a),
    });
    await caller.article.list({ projectId: "p1", sortBy: "title", sortDir: "asc" });
    expect(captured.orderBy).toEqual({ title: "asc" });
  });
});
