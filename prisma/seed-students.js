// prisma/seed-students.js
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Form 3 Achievers, mixed intake.
// Boarders pay more (includes boarding) so they carry a slightly higher
// opening balance than day scholars.
//
// Balance rules:
//   boarder      → KES 3,000 – 6,999
//   day_scholar  → KES 1,000 – 4,999
//
// Balances are deterministic per admission number, so re-running
// the seed gives the same values (useful for testing).

const STUDENTS = [
  // ---- Girls — Boarders ----
  { first: 'Grace',     last: 'Wanjiru',    type: 'boarder' },
  { first: 'Faith',     last: 'Chebet',     type: 'boarder' },
  { first: 'Aisha',     last: 'Hassan',     type: 'boarder' },
  { first: 'Mercy',     last: 'Achieng',    type: 'boarder' },
  { first: 'Cynthia',   last: 'Nyambura',   type: 'boarder' },
  { first: 'Halima',    last: 'Abdi',       type: 'boarder' },
  { first: 'Purity',    last: 'Wanjiku',    type: 'boarder' },
  { first: 'Zainab',    last: 'Mwinyi',     type: 'boarder' },
  { first: 'Elizabeth', last: 'Ochieng',    type: 'boarder' },
  { first: 'Sheila',    last: 'Kiptoo',     type: 'boarder' },

  // ---- Girls — Day scholars ----
  { first: 'Winnie',    last: 'Muthoni',    type: 'day_scholar' },
  { first: 'Naomi',     last: 'Kilonzo',    type: 'day_scholar' },
  { first: 'Ruth',      last: 'Auma',       type: 'day_scholar' },
  { first: 'Stacy',     last: 'Wairimu',    type: 'day_scholar' },
  { first: 'Lydia',     last: 'Kamau',      type: 'day_scholar' },

  // ---- Boys — Boarders ----
  { first: 'Brian',     last: 'Kiprop',     type: 'boarder' },
  { first: 'Kevin',     last: 'Otieno',     type: 'boarder' },
  { first: 'Joshua',    last: 'Juma',       type: 'boarder' },
  { first: 'Dennis',    last: 'Mwangi',     type: 'boarder' },
  { first: 'Emmanuel',  last: 'Odhiambo',   type: 'boarder' },
  { first: 'Peter',     last: 'Kariuki',    type: 'boarder' },
  { first: 'Alex',      last: 'Mburu',      type: 'boarder' },
  { first: 'Collins',   last: 'Kiptanui',   type: 'boarder' },
  { first: 'Martin',    last: 'Onyango',    type: 'boarder' },
  { first: 'Samuel',    last: 'Njoroge',    type: 'boarder' },

  // ---- Boys — Day scholars ----
  { first: 'Victor',    last: 'Wekesa',     type: 'day_scholar' },
  { first: 'Ibrahim',   last: 'Yusuf',      type: 'day_scholar' },
  { first: 'Felix',     last: 'Kirui',      type: 'day_scholar' },
  { first: 'Antony',    last: 'Wafula',     type: 'day_scholar' },
  { first: 'Eric',      last: 'Mutua',      type: 'day_scholar' },
];

const CLASS_NAME = 'Form 3';
const STREAM_NAME = 'Achievers';

// ---------- helpers ----------

function pad(n, w = 3) {
  return String(n).padStart(w, '0');
}

/**
 * Deterministic pseudo-random 32-bit hash from a string.
 * Same input → same output, so re-runs are stable.
 */
function hashString(s) {
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  return h >>> 0;
}

/**
 * Return an integer in [min, max] derived from a string seed.
 */
function seededInt(seed, min, max) {
  const range = max - min + 1;
  return min + (hashString(seed) % range);
}

/**
 * Opening balance per student:
 *   boarder      → 3,000 – 6,999
 *   day_scholar  → 1,000 – 4,999
 * Rounded to the nearest 50 (as a real school ledger would be).
 */
function openingBalanceFor(admissionNumber, studentType) {
  const isBoarder = studentType === 'boarder';
  const min = isBoarder ? 3000 : 1000;
  const max = isBoarder ? 6999 : 4999;
  const raw = seededInt(`${admissionNumber}|balance`, min, max);
  return Math.round(raw / 50) * 50;
}

// ---------- main ----------

async function main() {
  console.log(
    `Seeding ${STUDENTS.length} students into ${CLASS_NAME} ${STREAM_NAME}...`
  );

  const year = new Date().getFullYear();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const admissionNumber = `ADM-${year}-${pad(i + 1)}`;
    const creditBalance = openingBalanceFor(admissionNumber, s.type);

    try {
      const existing = await prisma.student.findUnique({
        where: { admission_number: admissionNumber },
        select: { id: true },
      });

      if (existing) {
        // Update the balance in case it was seeded with an older value
        await prisma.student.update({
          where: { id: existing.id },
          data: { credit_balance: creditBalance },
        });
        updated++;
        const tag = s.type === 'boarder' ? 'B' : 'D';
        console.log(
          `  ~ [${tag}] ${admissionNumber}  ${s.first} ${s.last}   balance ${creditBalance}`
        );
      } else {
        await prisma.student.create({
          data: {
            admission_number: admissionNumber,
            first_name: s.first,
            last_name: s.last,
            class_name: CLASS_NAME,
            stream_name: STREAM_NAME,
            student_type: s.type,
            credit_balance: creditBalance,
            is_active: true,
          },
        });
        created++;
        const tag = s.type === 'boarder' ? 'B' : 'D';
        console.log(
          `  ✓ [${tag}] ${admissionNumber}  ${s.first} ${s.last}   balance ${creditBalance}`
        );
      }
    } catch (e) {
      if (e.code === 'P2002') {
        skipped++;
      } else {
        console.error(`  ✗ ${admissionNumber}  ${s.first} ${s.last}`, e.message);
      }
    }
  }

  // ---------- summary ----------
  const where = { class_name: CLASS_NAME, stream_name: STREAM_NAME };

  const total = await prisma.student.count({ where });
  const boarders = await prisma.student.count({
    where: { ...where, student_type: 'boarder' },
  });
  const dayScholars = await prisma.student.count({
    where: { ...where, student_type: 'day_scholar' },
  });

  const sumBoarders = await prisma.student.aggregate({
    where: { ...where, student_type: 'boarder' },
    _sum: { credit_balance: true },
    _avg: { credit_balance: true },
  });
  const sumDay = await prisma.student.aggregate({
    where: { ...where, student_type: 'day_scholar' },
    _sum: { credit_balance: true },
    _avg: { credit_balance: true },
  });

  console.log('');
  console.log(`Created:   ${created}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Total:     ${total} in ${CLASS_NAME} ${STREAM_NAME}`);
  console.log('');
  console.log(
    `Boarders:  ${boarders}   total owed ${Number(
      sumBoarders._sum.credit_balance ?? 0
    ).toLocaleString()}   avg ${Math.round(
      Number(sumBoarders._avg.credit_balance ?? 0)
    ).toLocaleString()}`
  );
  console.log(
    `Day:       ${dayScholars}   total owed ${Number(
      sumDay._sum.credit_balance ?? 0
    ).toLocaleString()}   avg ${Math.round(
      Number(sumDay._avg.credit_balance ?? 0)
    ).toLocaleString()}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });