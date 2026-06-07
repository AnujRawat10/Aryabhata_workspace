# Article Review Workspace

A full-stack app for importing research articles from a PubMed-style `.xlsx`
export, browsing them in a filterable table, and recording per-reviewer
**Include / Exclude / Maybe** decisions — the core loop of a systematic
literature review.

This is **Phase 1**: a deliberately small, readable, end-to-end slice. Every
feature in the brief is wired up, but implemented in the simplest way that still
demonstrates the full stack working together. Where I chose simplicity over a
more elaborate approach, it is called out in **Known tradeoffs** below.

---

## 1. Setup

**Prerequisites:** Node 18+ and a running PostgreSQL instance.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env so DATABASE_URL points at your Postgres database
#    (a sane local default is already filled in)

# 3. Create the database schema
npx prisma migrate dev --name init

# 4. Seed demo users, an org, a project, and sample articles
npx prisma db seed

# 5. Run it
npm run dev      # http://localhost:3000
```

**Demo logins** (created by the seed):

| Email              | Password      | Role                          |
| ------------------ | ------------- | ----------------------------- |
| `admin@demo.com`   | `password123` | Org **owner** + project owner |
| `reviewer@demo.com`| `password123` | Org member + project reviewer |

Other useful scripts:

```bash
npm run test        # Vitest (import validation + tRPC filter/sort + authz)
npm run typecheck   # tsc --noEmit
npm run db:studio   # browse the DB in Prisma Studio
npm run build       # production build
```

> The whole app comes up with just: `npm install` → `npx prisma migrate dev`
> → `npx prisma db seed` → `npm run dev`.

---

## 2. Architecture overview

Built on the **T3 stack** conventions (Next.js App Router + tRPC + Prisma +
NextAuth + Tailwind), structured for readability.

```
src/
  app/                          # Next.js App Router pages + route handlers
    api/auth/[...nextauth]/     #   NextAuth endpoint
    api/trpc/[trpc]/            #   tRPC HTTP handler
    auth/signin, auth/signup    #   credential auth pages
    dashboard/                  #   orgs + projects you belong to
    projects/[projectId]/       #   main article table
    projects/[projectId]/import #   .xlsx upload + summary
  components/                   # small, composable UI (header, states, badge, review panel)
  server/
    auth.ts                     # NextAuth credentials config (JWT sessions)
    db.ts                       # Prisma client singleton
    import/parseArticles.ts     # PURE import validation logic (no framework deps)
    api/
      trpc.ts                   # context + publicProcedure / protectedProcedure
      authz.ts                  # requireProjectMember / requireProjectOwner / requireOrgOwner
      root.ts                   # merges all routers
      routers/                  # auth, organization, project, article, review
  trpc/react.tsx                # typed client hooks + React Query provider
prisma/
  schema.prisma                 # data model
  seed.ts                       # demo data (imports via the same parser the app uses)
test/                           # Vitest
```

**Data flow:** UI calls a typed `api.*` hook → tRPC procedure → authorization
check (`authz.ts`) → Prisma → Postgres. The client only ever holds React Query
state; there is no separate global store.

**Key models:** `User`, `Organization` + `OrganizationMember`, `Project` +
`ProjectMember`, `Article`, and `ReviewDecision` (one row per user per article,
enforced by a `@@unique([articleId, userId])`).

---

## 3. Import validation — decisions & reasoning

All parsing lives in [`src/server/import/parseArticles.ts`](src/server/import/parseArticles.ts)
as a **pure function** so it is fully unit-tested with no database. The browser
reads the `.xlsx` with the `xlsx` package into plain rows; those rows are POSTed
to `article.import`, which validates and persists them **server-side inside a
Prisma transaction** (all-or-nothing).

| Case                          | Behaviour                                          | Why |
| ----------------------------- | -------------------------------------------------- | --- |
| Missing **PMID**              | **Skip** row, report it                            | PMID is the stable identity + dedup key; a row without one can't be deduped or linked. |
| Missing **title**             | Import, flag a **warning**                          | A title-less record is still worth reviewing; the reviewer can fix it. |
| Missing **authors**           | Import as `"Unknown"`, warn                          | Authorship is descriptive, not identifying — never a reason to drop a row. |
| Duplicate **PMID** in project | **Skip**, report                                    | Same article; importing twice would split review decisions. |
| Duplicate **DOI** in project  | **Skip**, report                                    | Same as above, via the other stable identifier. |
| Non-numeric year (`"Twenty twenty"`) | Set year to `null`, flag                     | Keep the article; just don't store a bogus number. |
| Future year (`> current year`)| Import, flag a **warning**                          | Likely a typo, but legitimately possible (early-access) — surface it, don't block. |
| Whitespace                    | Trimmed on every field                              | Spreadsheet exports are full of stray spaces. |
| DOI formatting                | Strip leading `DOI:`, lowercase, trim               | Normalizing makes duplicate detection reliable. |

Duplicate detection runs against **both** existing project rows **and** earlier
rows in the same file. The summary modal reports total processed, imported,
skipped (with reasons), and warning rows (with flags).

---

## 4. Review workflow

- Click an article title to open a **slide-over review panel** showing every
  metadata field.
- **Include / Exclude / Maybe** buttons set your decision. The badge updates
  **optimistically** (instantly) and rolls back if the server rejects it.
- The **Notes** textarea **auto-saves on blur**.
- Decisions are **per user per article** (`ReviewDecision`), so two reviewers on
  the same project keep independent verdicts. The table badge reflects *your*
  decision; the panel footer shows who last touched the article and when.
- **Bulk action:** select rows with the checkboxes and set one decision for all
  of them at once.

---

## 5. Authorization (enforced server-side)

Every protected procedure calls a helper in
[`src/server/api/authz.ts`](src/server/api/authz.ts) — the UI never decides
access on its own.

- See articles → must be a **project member** (`article.list`, `getById`).
- Set a decision → must be a **project member** (`review.*`).
- Create a project → must be an **org owner** (`project.create`).
- Trigger an import → must be a **project owner** (`article.import`).

This is covered by tests: an unauthenticated caller gets `UNAUTHORIZED`, and a
non-member gets `FORBIDDEN`.

---

## 6. Known tradeoffs & limitations (Phase 1)

- **Login** uses NextAuth's `signIn()` directly; the `auth` router exposes
  `register` only (NextAuth owns the credential exchange). The brief lists
  "auth: login, register" — login is functionally present, just via NextAuth.
- **Import file is parsed in the browser**, not uploaded as a multipart file.
  This keeps the server logic a clean, testable pure function and avoids file
  plumbing. Validation and persistence are still fully server-side and authorized.
- **Notes before a decision** default the decision to `MAYBE` (writing notes
  implies the article is under consideration). A stricter UX would block this.
- **Sorting** is limited to article columns (title, author, journal, year,
  created). Decision/notes are per-user and not sortable in this phase.
- No org/project member-management UI yet (the `addMember` procedures exist and
  are authorized, but aren't surfaced in the UI).
- No optimistic update for the *bulk* action (it invalidates and refetches) —
  only the single-article decision is optimistic.

---

## 7. What I'd improve next

- A real multipart upload endpoint + server-side `.xlsx` parsing with a row-cap
  and streaming for large files.
- Member-management UI (invite by email, change roles) for orgs and projects.
- "Reviewer agreement" view comparing two reviewers' decisions + conflict
  resolution, which is the real payoff of per-user decisions.
- Saved filters / URL-synced filter state so a view is shareable and bookmarkable.
- Server-side cursor pagination + a column for "decided by N reviewers".
- E2E tests (Playwright) and a CI workflow; component tests for the table.

---

## 8. AI usage disclosure

AI coding assistance was used as a pair programmer while building this project:
scaffolding the T3-style structure, drafting the Prisma schema, tRPC routers,
import parser, React UI, and tests, then iterating to a clean
`typecheck` / `test` / `build`. All code was reviewed for correctness, and the
architecture/scoping decisions (e.g. parse-in-browser, per-user decisions,
Phase-1 simplifications) were made deliberately and are documented above.

---

## 9. Approximate time spent

~3–4 hours of focused build time for this Phase 1 slice (scaffold → schema →
backend routers + authz → import parser + tests → frontend table/panel/import →
verification → docs).

---

## Environment variables

See [`.env.example`](.env.example):

```
DATABASE_URL=postgresql://...      # Postgres connection string
NEXTAUTH_SECRET=...                # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```
