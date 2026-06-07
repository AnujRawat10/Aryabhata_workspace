/**
 * Seeds the database with two demo users, one organization, one project, and a
 * handful of sample articles so the app is usable immediately after setup.
 *
 *   admin@demo.com    / password123   (org OWNER + project OWNER)
 *   reviewer@demo.com / password123   (org MEMBER + project REVIEWER)
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parseArticles, type RawRow } from "../src/server/import/parseArticles";

const db = new PrismaClient();

// A small slice of real-looking PubMed export rows used to demo the table.
const SAMPLE_ROWS: RawRow[] = [
  {
    PMID: "31452104",
    Title: "CRISPR-Cas9 gene editing for sickle cell disease",
    Authors: "Smith J, Patel R, Gomez L",
    Citation: "N Engl J Med. 2019;381(9):820-830.",
    "First Author": "Smith J",
    "Journal/Book": "New England Journal of Medicine",
    "Publication Year": "2019",
    "Create Date": "2019/08/24",
    PMCID: "PMC6800000",
    "NIHMS ID": "",
    DOI: "10.1056/NEJMoa1900000",
  },
  {
    PMID: "33301246",
    Title: "mRNA vaccine efficacy against SARS-CoV-2",
    Authors: "Doe A, Nakamura K",
    Citation: "Nature. 2020;588(7838):430-435.",
    "First Author": "Doe A",
    "Journal/Book": "Nature",
    "Publication Year": "2020",
    "Create Date": "2020/12/10",
    PMCID: "PMC7720000",
    "NIHMS ID": "NIHMS1650000",
    DOI: "DOI: 10.1038/s41586-020-2814-7",
  },
  {
    PMID: "28912345",
    Title: "Deep learning for retinal image diagnosis",
    Authors: "Lee H, Wang Q, Brown T",
    Citation: "Lancet Digit Health. 2017;1(2):e60-e70.",
    "First Author": "Lee H",
    "Journal/Book": "The Lancet Digital Health",
    "Publication Year": "2017",
    "Create Date": "2017/09/14",
    PMCID: "",
    "NIHMS ID": "",
    DOI: "10.1016/S2589-7500(17)30005-2",
  },
  {
    PMID: "30456789",
    Title: "", // missing title -> warning
    Authors: "Garcia M",
    Citation: "J Clin Oncol. 2018;36(15):1500-1510.",
    "First Author": "Garcia M",
    "Journal/Book": "Journal of Clinical Oncology",
    "Publication Year": "2018",
    "Create Date": "2018/05/20",
    PMCID: "",
    "NIHMS ID": "",
    DOI: "10.1200/JCO.2018.36.1500",
  },
  {
    PMID: "29111222",
    Title: "Gut microbiome and immune regulation",
    Authors: "", // missing authors -> "Unknown"
    Citation: "Cell. 2018;172(6):1198-1215.",
    "First Author": "",
    "Journal/Book": "Cell",
    "Publication Year": "2018",
    "Create Date": "2018/03/08",
    PMCID: "PMC5900000",
    "NIHMS ID": "",
    DOI: "10.1016/j.cell.2018.02.044",
  },
];

async function main() {
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

  // Import the sample articles through the SAME validation logic the app uses.
  const result = parseArticles(SAMPLE_ROWS);
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
    `Seeded: 2 users, 1 org, 1 project, ${result.imported.length} articles (${result.skipped.length} skipped).`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
