"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { DecisionBadge, type DecisionValue } from "~/components/ui/DecisionBadge";
import { LoadingSkeleton, ErrorState } from "~/components/ui/States";

const DECISIONS: Exclude<DecisionValue, null>[] = ["INCLUDE", "EXCLUDE", "MAYBE"];

/** Slide-over panel for reviewing a single article. */
export function ReviewPanel({ articleId, onClose }: { articleId: string; onClose: () => void }) {
  const utils = api.useUtils();
  const article = api.article.getById.useQuery({ articleId });
  const [notes, setNotes] = useState("");

  // Sync the local notes box when the article loads/changes.
  useEffect(() => {
    setNotes(article.data?.myDecision?.notes ?? "");
  }, [article.data?.myDecision?.notes, articleId]);

  const setDecision = api.review.setDecision.useMutation({
    // Optimistic update so the badge flips instantly.
    onMutate: async (vars) => {
      await utils.article.getById.cancel({ articleId });
      const prev = utils.article.getById.getData({ articleId });
      if (prev && vars.decision) {
        utils.article.getById.setData(
          { articleId },
          { ...prev, myDecision: { ...(prev.myDecision ?? ({} as any)), decision: vars.decision } },
        );
      }
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.article.getById.setData({ articleId }, ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Saved."),
    onSettled: async () => {
      await Promise.all([utils.article.getById.invalidate({ articleId }), utils.article.list.invalidate()]);
    },
  });

  const data = article.data;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Review article</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 p-5">
          {article.isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : article.isError ? (
            <ErrorState message={article.error.message} onRetry={() => article.refetch()} />
          ) : data ? (
            <>
              <div>
                <h3 className="text-base font-semibold">
                  {data.title ?? <span className="italic text-gray-400">(untitled)</span>}
                </h3>
                <div className="mt-1">
                  <DecisionBadge decision={(data.myDecision?.decision as DecisionValue) ?? null} />
                </div>
              </div>

              {/* Metadata */}
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                <Meta label="PMID" value={data.pmid} />
                <Meta label="Authors" value={data.authors} span />
                <Meta label="First author" value={data.firstAuthor} />
                <Meta label="Journal" value={data.journal} />
                <Meta label="Year" value={data.publicationYear?.toString()} />
                <Meta label="Citation" value={data.citation} span />
                <Meta label="Create date" value={data.createDate} />
                <Meta label="PMCID" value={data.pmcid} />
                <Meta label="NIHMS ID" value={data.nihmsId} />
                <Meta label="DOI" value={data.doi} span />
              </dl>

              {/* Decision buttons */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Your decision</p>
                <div className="flex gap-2">
                  {DECISIONS.map((d) => {
                    const active = data.myDecision?.decision === d;
                    return (
                      <button
                        key={d}
                        disabled={setDecision.isPending}
                        onClick={() => setDecision.mutate({ articleId, decision: d })}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes (auto-saved on blur) */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if (notes !== (data.myDecision?.notes ?? "")) {
                      setDecision.mutate({ articleId, notes });
                    }
                  }}
                  rows={4}
                  placeholder="Add review notes… (saved when you click away)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Last reviewed */}
              <p className="text-xs text-gray-400">
                {data.lastReviewedBy
                  ? `Last reviewed by ${data.lastReviewedBy.name} on ${new Date(
                      data.lastReviewedBy.at,
                    ).toLocaleString()}`
                  : "Not yet reviewed by anyone."}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
  return (
    <div className={span ? "col-span-3" : "col-span-1"}>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="break-words text-gray-800">{value || "—"}</dd>
    </div>
  );
}
