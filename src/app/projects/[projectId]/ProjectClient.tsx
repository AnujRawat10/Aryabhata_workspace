"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { DecisionBadge } from "~/components/ui/DecisionBadge";
import { EmptyState, ErrorState, LoadingSkeleton } from "~/components/ui/States";
import { ReviewPanel } from "~/components/ReviewPanel";
import { ProjectMembers } from "~/components/ProjectMembers";

type DecisionFilter = "INCLUDE" | "EXCLUDE" | "MAYBE" | "UNREVIEWED";
type SortBy = "title" | "firstAuthor" | "journal" | "publicationYear" | "createdAt";

const DECISION_OPTIONS: DecisionFilter[] = ["INCLUDE", "EXCLUDE", "MAYBE", "UNREVIEWED"];

export function ProjectClient({ projectId }: { projectId: string }) {
  // ----- Filter / sort / pagination state -----
  const [search, setSearch] = useState("");
  const [decisions, setDecisions] = useState<DecisionFilter[]>([]);
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // ----- Selection (bulk) & open review panel -----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  const project = api.project.getById.useQuery({ projectId });
  const utils = api.useUtils();

  const listInput = useMemo(
    () => ({
      projectId,
      search: search.trim() || undefined,
      decisions: decisions.length ? decisions : undefined,
      yearMin: yearMin ? Number(yearMin) : undefined,
      yearMax: yearMax ? Number(yearMax) : undefined,
      sortBy,
      sortDir,
      page,
    }),
    [projectId, search, decisions, yearMin, yearMax, sortBy, sortDir, page],
  );

  const articles = api.article.list.useQuery(listInput);

  const bulkSet = api.review.setDecisionBulk.useMutation({
    onSuccess: async (r) => {
      toast.success(`Updated ${r.count} article(s).`);
      setSelected(new Set());
      await utils.article.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function toggleDecision(d: DecisionFilter) {
    setSelected(new Set());
    setPage(1);
    setDecisions((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const isOwner = project.data?.viewerRole === "OWNER";
  const items = articles.data?.items ?? [];
  const total = articles.data?.total ?? 0;
  const pageSize = articles.data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {project.data ? project.data.name : "Loading…"}
          </h1>
          {project.data && (
            <p className="text-sm text-gray-500">
              {project.data.organization?.name} · {project.data._count.articles} articles
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembers((s) => !s)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {showMembers ? "Hide members" : "Members"}
          </button>
          {isOwner && (
            <Link
              href={`/projects/${projectId}/import`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Import articles
            </Link>
          )}
        </div>
      </div>

      {showMembers && <ProjectMembers projectId={projectId} canManage={isOwner} />}

      {/* Filters */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title, author, journal…"
            className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Year</span>
            <input
              value={yearMin}
              onChange={(e) => {
                setYearMin(e.target.value);
                setPage(1);
              }}
              placeholder="min"
              inputMode="numeric"
              className="w-20 rounded-md border border-gray-300 px-2 py-2"
            />
            <span className="text-gray-400">–</span>
            <input
              value={yearMax}
              onChange={(e) => {
                setYearMax(e.target.value);
                setPage(1);
              }}
              placeholder="max"
              inputMode="numeric"
              className="w-20 rounded-md border border-gray-300 px-2 py-2"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Decision:</span>
          {DECISION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDecision(d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                decisions.includes(d)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="text-gray-500">Set decision:</span>
          {(["INCLUDE", "EXCLUDE", "MAYBE"] as const).map((d) => (
            <button
              key={d}
              disabled={bulkSet.isPending}
              onClick={() => bulkSet.mutate({ articleIds: [...selected], decision: d })}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-500 hover:underline">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {articles.isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : articles.isError ? (
        <ErrorState message={articles.error.message} onRetry={() => articles.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No articles found"
          message={
            search || decisions.length || yearMin || yearMax
              ? "No articles match your filters. Try clearing them."
              : "This project has no articles yet. Import a .xlsx file to get started."
          }
          action={
            isOwner ? (
              <Link
                href={`/projects/${projectId}/import`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Import articles
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300"
                  />
                </th>
                <SortableTh label="Title" col="title" {...{ sortBy, sortDir, toggleSort }} />
                <SortableTh label="First Author" col="firstAuthor" {...{ sortBy, sortDir, toggleSort }} />
                <SortableTh label="Journal" col="journal" {...{ sortBy, sortDir, toggleSort }} />
                <SortableTh label="Year" col="publicationYear" {...{ sortBy, sortDir, toggleSort }} />
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const isSelected = selected.has(a.id);
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-gray-100 transition-colors last:border-0 ${
                      isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 cursor-pointer rounded border-gray-300"
                      />
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <button
                        onClick={() => setOpenArticleId(a.id)}
                        className="line-clamp-2 text-left font-medium text-gray-900 hover:text-blue-700 hover:underline"
                      >
                        {a.title ?? <span className="italic text-gray-400">(untitled)</span>}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{a.firstAuthor ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.journal ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.publicationYear ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DecisionBadge decision={a.decision} />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">{a.notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {totalPages} · {total} articles
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Review side panel */}
      {openArticleId && (
        <ReviewPanel articleId={openArticleId} onClose={() => setOpenArticleId(null)} />
      )}
    </div>
  );
}

function SortableTh({
  label,
  col,
  sortBy,
  sortDir,
  toggleSort,
}: {
  label: string;
  col: SortBy;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  toggleSort: (c: SortBy) => void;
}) {
  const active = sortBy === col;
  return (
    <th className="px-3 py-3">
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-gray-800">
        {label}
        <span className="text-gray-400">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
