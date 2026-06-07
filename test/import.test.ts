import { describe, it, expect } from "vitest";
import { parseArticles, normalizeDoi, type RawRow } from "../src/server/import/parseArticles";

/** Build a row with sensible defaults, overridable per test. */
function row(overrides: Partial<Record<string, unknown>> = {}): RawRow {
  return {
    PMID: "1001",
    Title: "A study",
    Authors: "Doe J",
    Citation: "Journal. 2020;1:1-2.",
    "First Author": "Doe J",
    "Journal/Book": "Journal",
    "Publication Year": "2020",
    "Create Date": "2020/01/01",
    PMCID: "",
    "NIHMS ID": "",
    DOI: "10.1/abc",
    ...overrides,
  };
}

describe("normalizeDoi", () => {
  it("strips the DOI: prefix, lowercases, and trims", () => {
    expect(normalizeDoi("  DOI: 10.1038/ABC  ")).toBe("10.1038/abc");
    expect(normalizeDoi("doi:10.1/X")).toBe("10.1/x");
  });
  it("returns null for empty input", () => {
    expect(normalizeDoi("   ")).toBeNull();
  });
});

describe("parseArticles", () => {
  it("imports a clean row with no warnings", () => {
    const r = parseArticles([row()]);
    expect(r.imported).toHaveLength(1);
    expect(r.skipped).toHaveLength(0);
    expect(r.imported[0]!.warnings).toEqual([]);
    expect(r.imported[0]!.doi).toBe("10.1/abc");
  });

  it("skips rows with a missing PMID and reports them", () => {
    const r = parseArticles([row({ PMID: "" })]);
    expect(r.imported).toHaveLength(0);
    expect(r.skipped[0]).toMatchObject({ rowNumber: 2, reason: "Missing PMID" });
  });

  it("imports a missing title but flags a warning", () => {
    const r = parseArticles([row({ Title: "" })]);
    expect(r.imported[0]!.title).toBeNull();
    expect(r.imported[0]!.warnings).toContain("Missing title");
  });

  it("defaults missing authors to Unknown", () => {
    const r = parseArticles([row({ Authors: "" })]);
    expect(r.imported[0]!.authors).toBe("Unknown");
    expect(r.imported[0]!.warnings.join()).toMatch(/Missing authors/);
  });

  it("sets a non-numeric publication year to null and flags it", () => {
    const r = parseArticles([row({ "Publication Year": "Twenty twenty" })]);
    expect(r.imported[0]!.publicationYear).toBeNull();
    expect(r.imported[0]!.warnings.join()).toMatch(/Invalid publication year/);
  });

  it("flags a future publication year but still imports it", () => {
    const r = parseArticles([row({ "Publication Year": "3000" })], new Set(), new Set(), 2026);
    expect(r.imported[0]!.publicationYear).toBe(3000);
    expect(r.imported[0]!.warnings.join()).toMatch(/Future publication year/);
  });

  it("trims whitespace on all fields", () => {
    const r = parseArticles([row({ Title: "  Spaced  ", "First Author": "  X  " })]);
    expect(r.imported[0]!.title).toBe("Spaced");
    expect(r.imported[0]!.firstAuthor).toBe("X");
  });

  it("skips a duplicate PMID within the same batch", () => {
    const r = parseArticles([row({ PMID: "5" }), row({ PMID: "5", DOI: "10.1/other" })]);
    expect(r.imported).toHaveLength(1);
    expect(r.skipped[0]!.reason).toMatch(/Duplicate PMID/);
  });

  it("skips a duplicate DOI within the same batch", () => {
    const r = parseArticles([
      row({ PMID: "5", DOI: "10.1/same" }),
      row({ PMID: "6", DOI: "DOI: 10.1/SAME" }),
    ]);
    expect(r.imported).toHaveLength(1);
    expect(r.skipped[0]!.reason).toMatch(/Duplicate DOI/);
  });

  it("skips duplicates against pre-existing project identifiers", () => {
    const r = parseArticles([row({ PMID: "9" })], new Set(["9"]), new Set());
    expect(r.imported).toHaveLength(0);
    expect(r.skipped[0]!.reason).toMatch(/Duplicate PMID/);
  });

  it("reads Journal from the Journal/Book column", () => {
    const r = parseArticles([row({ "Journal/Book": "Nature" })]);
    expect(r.imported[0]!.journal).toBe("Nature");
  });
});
