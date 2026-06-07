/**
 * Pure, framework-free parsing & validation for article imports.
 *
 * This file deliberately has NO dependency on Prisma, Next, or xlsx so it is
 * trivial to unit-test. The caller (article.import tRPC procedure) is
 * responsible for reading the .xlsx into plain row objects and for persisting
 * the result inside a transaction.
 *
 * See README "Import validation decisions" for the reasoning behind each rule.
 */

/** A raw row as produced by `xlsx`'s sheet_to_json: header -> cell value. */
export type RawRow = Record<string, unknown>;

export interface ParsedArticle {
  pmid: string;
  title: string | null;
  authors: string;
  citation: string | null;
  firstAuthor: string | null;
  journal: string | null;
  publicationYear: number | null;
  createDate: string | null;
  pmcid: string | null;
  nihmsId: string | null;
  doi: string | null;
  /** Non-fatal issues; the row is still imported. */
  warnings: string[];
}

export interface SkippedRow {
  /** 1-based row number as it appears to a human reading the spreadsheet. */
  rowNumber: number;
  reason: string;
  pmid?: string;
}

export interface ImportResult {
  total: number;
  imported: ParsedArticle[];
  skipped: SkippedRow[];
}

/** Read a cell by trying several possible header spellings (case-insensitive). */
function readCell(row: RawRow, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
    if (match !== undefined) {
      const value = row[match];
      if (value === null || value === undefined) return "";
      return String(value).trim();
    }
  }
  return "";
}

/** Normalize a DOI: strip a leading "DOI:" label, lowercase, trim. */
export function normalizeDoi(raw: string): string | null {
  let doi = raw.trim();
  if (doi === "") return null;
  // Strip a leading "doi:" / "DOI:" label if present.
  doi = doi.replace(/^doi:\s*/i, "");
  doi = doi.trim().toLowerCase();
  return doi === "" ? null : doi;
}

/**
 * Parse and validate raw spreadsheet rows into article records.
 *
 * @param rows           Raw rows (already extracted from the .xlsx).
 * @param existingPmids  PMIDs already in the target project (for dedup).
 * @param existingDois   Normalized DOIs already in the target project (for dedup).
 * @param currentYear    Injected so "future year" checks are deterministic in tests.
 */
export function parseArticles(
  rows: RawRow[],
  existingPmids: Set<string> = new Set(),
  existingDois: Set<string> = new Set(),
  currentYear: number = new Date().getFullYear(),
): ImportResult {
  const imported: ParsedArticle[] = [];
  const skipped: SkippedRow[] = [];

  // Track values seen earlier in THIS batch so in-file duplicates are caught too.
  const seenPmids = new Set<string>(existingPmids);
  const seenDois = new Set<string>(existingDois);

  rows.forEach((row, index) => {
    // Row 1 is the header in the sheet, so data starts visually at row 2.
    const rowNumber = index + 2;

    const pmid = readCell(row, "PMID");
    if (pmid === "") {
      skipped.push({ rowNumber, reason: "Missing PMID" });
      return;
    }

    if (seenPmids.has(pmid)) {
      skipped.push({ rowNumber, pmid, reason: `Duplicate PMID "${pmid}" in this project` });
      return;
    }

    const rawDoi = readCell(row, "DOI");
    const doi = normalizeDoi(rawDoi);
    if (doi && seenDois.has(doi)) {
      skipped.push({ rowNumber, pmid, reason: `Duplicate DOI "${doi}" in this project` });
      return;
    }

    const warnings: string[] = [];

    // Title: warn if missing but still import.
    const titleRaw = readCell(row, "Title");
    const title = titleRaw === "" ? null : titleRaw;
    if (title === null) warnings.push("Missing title");

    // Authors: default to "Unknown" when absent.
    const authorsRaw = readCell(row, "Authors");
    const authors = authorsRaw === "" ? "Unknown" : authorsRaw;
    if (authorsRaw === "") warnings.push("Missing authors (defaulted to Unknown)");

    // Publication year: non-numeric -> null + flag; future -> warn but keep.
    const yearRaw = readCell(row, "Publication Year");
    let publicationYear: number | null = null;
    if (yearRaw !== "") {
      // Accept only a clean integer like "2021"; reject "Twenty twenty".
      const isNumeric = /^\d{1,4}$/.test(yearRaw);
      if (isNumeric) {
        publicationYear = parseInt(yearRaw, 10);
        if (publicationYear > currentYear) {
          warnings.push(`Future publication year (${publicationYear})`);
        }
      } else {
        warnings.push(`Invalid publication year "${yearRaw}" (set to null)`);
      }
    }

    const article: ParsedArticle = {
      pmid,
      title,
      authors,
      citation: emptyToNull(readCell(row, "Citation")),
      firstAuthor: emptyToNull(readCell(row, "First Author")),
      journal: emptyToNull(readCell(row, "Journal/Book", "Journal", "Book")),
      publicationYear,
      createDate: emptyToNull(readCell(row, "Create Date")),
      pmcid: emptyToNull(readCell(row, "PMCID")),
      nihmsId: emptyToNull(readCell(row, "NIHMS ID", "NIHMS")),
      doi,
      warnings,
    };

    // Reserve the identifiers so later rows in the same batch dedup against them.
    seenPmids.add(pmid);
    if (doi) seenDois.add(doi);

    imported.push(article);
  });

  return { total: rows.length, imported, skipped };
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}
