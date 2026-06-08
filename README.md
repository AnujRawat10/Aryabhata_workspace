# Aryabhata Workspace

An article review workspace for systematic literature reviews. You sign in, work inside an organization and a project, import research articles from a PubMed-style Excel export, and review them in a table with Include / Exclude / Maybe decisions and notes.

The inspiration is Mendeley, which I used a lot during my undergrad to manage references. I wanted a small Indian take on that idea, so I named it after Aryabhata, the classical Indian mathematician and astronomer, and used saffron (bhagwa) accents to give an otherwise plain app a bit of character. I kept it simple on purpose. The goal was to show I can build the whole slice end to end, not to fit in every feature. It took me about 4 to 5 hours.

Live demo: https://main.d3e2n0xjidykvd.amplifyapp.com

Demo logins (password `password123` for both):
- `admin@demo.com` is an org owner and project owner.
- `reviewer@demo.com` is a reviewer.

## Setup

You need Node 18+ and PostgreSQL.

npm install
npx prisma migrate dev      # create the tables
npx prisma db seed          # demo users + the sample articles
npm run dev                 # http://localhost:3002


## Architecture

Next.js (App Router) with TypeScript and Tailwind on the front end. tRPC for a typed API, Prisma for Postgres, NextAuth (credentials provider) for auth.

A few notes on how it fits together:

- Auth and database access run only on the server. Prisma is a single shared client in `src/server/db.ts`.
- Every tRPC procedure goes through an authorization check in `src/server/api/authz.ts` before it reads or writes anything.
- The import parser in `src/server/import/parseArticles.ts` is a plain function with no framework dependencies, which keeps it easy to test.
- Pages are server components that check the session, then render client components that load data through tRPC.

The data model is User, Organization and OrganizationMember, Project and ProjectMember, Article, and ReviewDecision (one row per user per article).

## Import handling

The browser reads the `.xlsx` with the `xlsx` package and sends the rows to the server. The server validates them and saves the valid ones inside a single transaction. The validation rules:

- Row with no PMID is skipped and reported, since PMID is the identity and the dedup key.
- Duplicate PMID or DOI within the project is skipped and reported.
- Missing title is imported but flagged.
- Missing authors is imported as "Unknown".
- A year that is not a number, like "Twenty twenty", is stored as null and flagged.
- A year in the future is imported but flagged.
- DOIs are normalized (drop a leading "DOI:", lowercase, trim) and every field is trimmed.

Run against the provided `sample_article_import.xlsx` this gives 22 imported, 3 skipped (duplicate DOI, duplicate PMID, missing PMID), and 4 flagged.

## Review workflow

Open an article to see all of its fields, pick Include, Exclude, or Maybe, and write notes that save when you click away. Decisions are stored per user, so two reviewers on the same project keep separate verdicts. The table shows your own decision and supports search, decision and year filters, sorting, pagination, a bulk decision action for selected rows, and a CSV export of the current filtered view.

## Authorization

Enforced on the server, not just hidden in the UI:

- Viewing articles requires project membership.
- Setting a decision requires project membership.
- Creating a project requires being an org owner.
- Importing requires being a project owner.

## Assumptions

This is one slice of the product, kept deliberately small. The Excel file is parsed in the browser instead of uploaded as a file, but validation and saving still happen on the server. Login goes through NextAuth, so the auth router only exposes register. Writing notes before choosing a decision defaults that decision to Maybe.

## Tradeoffs

Sorting covers the article columns but not the per-user decision. Single decisions update optimistically; the bulk action refetches instead. There is no file-size limit or streaming on import yet.

## Tests

Vitest, 20 tests. The import parser is tested for every validation rule above. The tRPC tests use a mocked Prisma client to confirm that a non-member is rejected and that the filters and sort build the right query. Run them with `npm test`.

## Deployment

Deployed on AWS Amplify for the app and Neon for Postgres.

- URL: https://main.d3e2n0xjidykvd.amplifyapp.com
- `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set as Amplify environment variables and are not committed.
- Schema changes use `prisma migrate deploy`; the build runs `prisma generate`.
- Server logs go to CloudWatch. Cost is low: Amplify is pay per use and the database is on Neon's free tier, so it runs at roughly zero to a couple of dollars a month at this traffic.

## AI usage

I used an AI coding assistant (claude.ai and chatgpt go) while building this.

It helped with the project scaffold, the Prisma schema, the tRPC routers, the import parser, the UI, and the tests. I made the product and architecture decisions myself (per-user decisions, parsing in the browser then validating on the server, the authorization model, keeping the scope small).

I verified the result by running the tests, typecheck, and build, importing the real sample file, and clicking through sign-in and sign-out, the filters, and the review flow against a local database.

One change I made to the AI's output: the first sign-up validated the raw email with `z.string().email()`, so an address with a stray space failed and the error showed up as raw JSON. I switched to trimming and lowercasing the email and showing a readable message (`src/server/api/routers/auth.ts`, `src/app/auth/signup/page.tsx`). I also turned down a suggestion to swap Postgres for SQLite, to stay on the required stack.

## What I would improve next

Two things I would add next. First, a real file-upload endpoint that takes the `.xlsx` on the server with a size limit, instead of parsing it in the browser. Second, a small summary above the table showing how many articles are Included, Excluded, Maybe, and still unreviewed.

## Time spent

Around 4 to 5 hours.
