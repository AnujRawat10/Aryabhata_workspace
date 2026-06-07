"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { api } from "~/trpc/react";

type Summary = {
  total: number;
  importedCount: number;
  skipped: { rowNumber: number; reason: string; pmid?: string }[];
  warnings: { pmid: string; title: string | null; flags: string[] }[];
};

const EXPECTED_COLUMNS = [
  "PMID",
  "Title",
  "Authors",
  "Citation",
  "First Author",
  "Journal/Book",
  "Publication Year",
  "Create Date",
  "PMCID",
  "NIHMS ID",
  "DOI",
];

export function ImportClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const importMutation = api.article.import.useMutation({
    onSuccess: (res) => {
      setSummary(res);
      toast.success(`Imported ${res.importedCount} of ${res.total} rows.`);
    },
    onError: (e) => toast.error(e.message),
  });

  async function onFile(file: File) {
    setParsing(true);
    setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      // defval keeps empty cells as "" so column detection stays stable.
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, { defval: "" });
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length === 0) toast.error("That sheet has no data rows.");
    } catch {
      toast.error("Could not read that file. Is it a valid .xlsx?");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to articles
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Import articles</h1>
        <p className="text-sm text-gray-500">
          Upload a PubMed-style <code>.xlsx</code> export. Only project owners can import.
        </p>
      </div>

      {/* Expected columns help */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <p className="mb-2 font-medium">Expected columns</p>
        <div className="flex flex-wrap gap-2">
          {EXPECTED_COLUMNS.map((c) => (
            <span key={c} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* File picker */}
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
        <input
          id="file"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <label
          htmlFor="file"
          className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Choose .xlsx file
        </label>
        <p className="mt-3 text-sm text-gray-500">
          {parsing ? "Reading file…" : fileName ? `${fileName} — ${rows.length} rows ready` : "No file selected"}
        </p>
      </div>

      {rows.length > 0 && (
        <button
          disabled={importMutation.isPending}
          onClick={() => importMutation.mutate({ projectId, rows })}
          className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {importMutation.isPending ? "Importing…" : `Import ${rows.length} rows`}
        </button>
      )}

      {summary && (
        <SummaryModal
          summary={summary}
          onClose={() => setSummary(null)}
          onDone={() => router.push(`/projects/${projectId}`)}
        />
      )}
    </div>
  );
}

function SummaryModal({
  summary,
  onClose,
  onDone,
}: {
  summary: Summary;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Import summary</h2>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Processed" value={summary.total} className="bg-gray-100 text-gray-700" />
          <Stat label="Imported" value={summary.importedCount} className="bg-green-100 text-green-700" />
          <Stat label="Skipped" value={summary.skipped.length} className="bg-red-100 text-red-700" />
        </div>

        {summary.skipped.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-medium text-red-700">Skipped rows</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {summary.skipped.map((s, i) => (
                <li key={i} className="rounded bg-red-50 px-3 py-1">
                  Row {s.rowNumber}: {s.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.warnings.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-medium text-yellow-700">
              Imported with warnings ({summary.warnings.length})
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {summary.warnings.map((w, i) => (
                <li key={i} className="rounded bg-yellow-50 px-3 py-1">
                  <span className="font-medium">{w.title ?? `PMID ${w.pmid}`}</span>: {w.flags.join("; ")}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Import another
          </button>
          <button onClick={onDone} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            View articles
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg p-3 ${className}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}
