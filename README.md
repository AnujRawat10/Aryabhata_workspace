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
npm run dev      # http://localhost:3002
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

**Verified against the provided `sample_article_import.xlsx`** (sheet "PubMed
Export", 25 rows) — the parser produced: **22 imported, 3 skipped** (duplicate
DOI, duplicate PMID, missing PMID) and **4 warnings** (missing title, the
`"Twenty twenty"` non-numeric year set to null, missing authors defaulted to
"Unknown", and a future year of 2035). No code changes were needed; the file's
columns matched directly.

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

**Tools used.** An AI coding assistant was used as a pair programmer throughout.

**What was AI-assisted.** Scaffolding the T3-style project structure, drafting the
Prisma schema, the tRPC routers and authorization helpers, the import parser, the
React/Tailwind UI, and the Vitest tests. Boilerplate (config files, provider
wiring) was largely AI-generated.

**What I directed and verified myself.** I made the product/architecture decisions
(per-user review decisions, parse-in-browser then validate-server-side, the
authorization model, scope control for this slice). I verified the result by
running the suite myself: `npm run test` (20 passing), `npm run typecheck` (clean),
`npm run build` (clean), importing the provided `sample_article_import.xlsx` and
confirming the 22/3/4 import outcome, and manually exercising sign-in/out, the
table filters, and the review flow against a local Postgres.

**One example where I corrected AI output.** The first sign-up implementation used
`z.string().email()` directly on the raw input. A valid address with a stray
leading/trailing space (common from autofill) failed validation, and the error was
surfaced to the user as raw JSON. I changed the schema to `z.string().trim()
.toLowerCase().email()`, trimmed the inputs on the client, and mapped the tRPC
`zodError` to a friendly field message — see
[`src/server/api/routers/auth.ts`](src/server/api/routers/auth.ts) and
[`src/app/auth/signup/page.tsx`](src/app/auth/signup/page.tsx). A second correction:
the AI initially suggested swapping PostgreSQL for SQLite to avoid local setup; I
rejected that to stay within the required stack and instead provisioned Postgres.

---

## 9. Approximate time spent

Roughly 6–8 hours total: project scaffold → Prisma schema + seed → tRPC routers and
server-side authorization → import parser + tests → the table / review panel /
import UI → member management → local Postgres setup, verification, and this README.

---

## 10. Deployment status & notes

**Status:** Not deployed at time of writing; runs locally via the steps in §1.
The app is deploy-ready and the intended target is **AWS** (Amplify Hosting for
the Next.js app + a managed Postgres). Notes on how each concern is / would be
handled:

- **Secrets.** Never committed — `.env` is git-ignored and only `.env.example`
  (with placeholders) is in the repo. In production, `DATABASE_URL`,
  `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set as environment variables in the
  host's config (Amplify console / AWS Secrets Manager), not in source.
- **Database migrations.** Schema changes go through Prisma Migrate. Locally:
  `prisma migrate dev`. In CI/deploy: `prisma migrate deploy` runs against the
  production database as part of the build step (never edit the DB by hand).
- **Logs.** Next.js server logs and tRPC errors go to the platform's log stream
  (CloudWatch on AWS). tRPC returns typed error codes
  (`UNAUTHORIZED`/`FORBIDDEN`/`CONFLICT`) that surface as toasts client-side.
- **Failure modes.** DB unreachable → procedures throw and the UI shows its error
  state with a retry; auth failure → redirect to sign-in; invalid import rows are
  skipped/flagged rather than failing the whole import; the import write is wrapped
  in a Prisma transaction so a partial import can't leave the project half-updated.
- **Cost.** A low-traffic deployment is inexpensive: the app host is pay-per-use
  (pennies/month at low traffic), and the main cost is the always-on database. A
  managed Postgres with a free tier (e.g. Neon) keeps the total at roughly
  $0–$2/month for a demo; a dedicated AWS RDS micro instance is ~$12/month.

---

## Environment variables

See [`.env.example`](.env.example):

```
DATABASE_URL=postgresql://...      # Postgres connection string
NEXTAUTH_SECRET=...                # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3002 # must match the dev port (npm run dev = 3002)
```
