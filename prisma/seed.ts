/**
 * Seeds the database with two demo users, one organization, one project, and the
 * REAL articles from `prisma/sample_article_import.xlsx` (no fabricated data) so
 * the app is usable immediately after setup.
 *
 *   admin@demo.com    / password123   (org OWNER + project OWNER)
 *   reviewer@demo.com / password123   (org MEMBER + project REVIEWER)
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import xlsxPkg from "xlsx";
import { parseArticles, type RawRow } from "../src/server/import/parseArticles";

const XLSX = xlsxPkg;
const db = new PrismaClient();

/** Read the real sample spreadsheet that ships with the repo. */
function loadSampleRows(): RawRow[] {
  const filePath = fileURLToPath(new URL("./sample_article_import.xlsx", import.meta.url));
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
}

async function main() {
  // Start from a clean slate so re-running the seed never duplicates rows.
  await db.reviewDecision.deleteMany();
  await db.article.deleteMany();
  await db.projectMember.deleteMany();
  await db.organizationMember.deleteMany();
  await db.project.deleteMany();
  await db.organization.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await db.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: { email: "admin@demo.com", name: "Admin Demo", password: passwordHash },
  });

  const reviewer = await db.user.upsert({
    where: { email: "reviewer@demo.com" },
    update: {},
    create: { email: "reviewer@demo.com", name: "Reviewer Demo", password: passwordHash },
  });

  // One organization, admin is the owner.
  const org = await db.organization.create({ data: { name: "Demo Research Lab" } });
  await db.organizationMember.createMany({
    data: [
      { userId: admin.id, organizationId: org.id, role: "OWNER" },
      { userId: reviewer.id, organizationId: org.id, role: "MEMBER" },
    ],
  });

  // One project, admin is the project owner, reviewer is a reviewer.
  const project = await db.project.create({
    data: { name: "Systematic Review 2024", organizationId: org.id },
  });
  await db.projectMember.createMany({
    data: [
      { userId: admin.id, projectId: project.id, role: "OWNER" },
      { userId: reviewer.id, projectId: project.id, role: "REVIEWER" },
    ],
  });

  // Import the REAL sample articles through the SAME validation logic the app uses.
  const result = parseArticles(loadSampleRows());
  await db.article.createMany({
    data: result.imported.map((a) => ({
      projectId: project.id,
      pmid: a.pmid,
      title: a.title,
      authors: a.authors,
      citation: a.citation,
      firstAuthor: a.firstAuthor,
      journal: a.journal,
      publicationYear: a.publicationYear,
      createDate: a.createDate,
      pmcid: a.pmcid,
      nihmsId: a.nihmsId,
      doi: a.doi,
    })),
  });

  console.log(
    `Seeded: 2 users, 1 org, 1 project, ${result.imported.length} articles imported, ${result.skipped.length} skipped.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
