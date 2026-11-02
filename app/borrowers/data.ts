/**
 * Placeholder past-borrower data, generated deterministically so the server and client agree.
 * Replace with the real borrower API once it exists.
 */

import { FACE_COUNT, FACE_NAMES } from "./faces";

export type Outcome = "repaid" | "second-loan" | "repaying";

export type Borrower = {
  id: number;
  name: string;
  village: string;
  state: string;
  livelihood: string;
  purpose: string;
  year: number;
  month: number;
  amount: number;
  tenure: number;
  outcome: Outcome;
  /** Index into the face atlas (see faces.ts). */
  face: number;
  /** 0, 1 or 2: which grey the frame shows until the photo loads. */
  tone: number;
};

export const TOTAL_BORROWERS = 31240;
/** How many previously placed faces a borrower avoids (leaves a few faces to choose from). */
const RECENT_FACES = Math.max(0, FACE_COUNT - 20);

const WOMEN = ["Lakshmi", "Sunita", "Meena", "Kavita", "Geeta", "Anita", "Rekha", "Savitri", "Pushpa", "Radha", "Sarita", "Manju", "Shanti", "Kamala", "Parvati", "Usha", "Jyoti", "Bimla", "Asha", "Durga", "Sita", "Pooja", "Rani", "Malati", "Sabita", "Rupali", "Nirmala", "Sumitra"];
const MEN = ["Ramesh", "Suresh", "Mahesh", "Rajesh", "Gopal", "Mohan", "Prakash", "Ravi", "Sanjay", "Anil", "Dinesh", "Mukesh", "Bharat", "Kishore", "Hari", "Shankar", "Babulal", "Ganesh", "Naresh", "Rajendra", "Biren", "Tapan", "Manoj", "Arjun"];
const SURNAMES = ["Devi", "Kumar", "Patil", "Naik", "Das", "Behera", "Yadav", "Meena", "Gowda", "Singh", "Sahu", "Rao", "Boro", "Mondal", "Jadhav", "Murmu", "Nayak", "Pradhan", "Reddy", "Kalita"];
const VILLAGES = ["Kotapally", "Rampur", "Belgaum Khurd", "Haripur", "Dhanpura", "Sonapur", "Kalimati", "Chandanpur", "Lakhanpur", "Malkangiri", "Nuagaon", "Barpali", "Kesariya", "Raghunathpur", "Bhimtal", "Sundarpur", "Ambagaon", "Hosahalli", "Tiruvallam", "Majuli", "Pipalkoti", "Devgarh", "Jhargram", "Kolhapur Wadi", "Mandvi", "Shivpuri", "Udaygiri", "Gopalganj"];
/** All 28 states of India. */
export const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
/** `name` is the gallery section; `people` is how the livelihood reads as a pill ("Weavers"). */
export const LIVELIHOODS: { name: string; people: string; purposes: string[] }[] = [
  { name: "Dairy farming", people: "Dairy farmers", purposes: ["a milch cow", "cattle feed", "a cattle shed"] },
  { name: "Handloom weaving", people: "Weavers", purposes: ["yarn", "a new loom", "dyes and raw material"] },
  { name: "Tailoring", people: "Tailors", purposes: ["a sewing machine", "fabric stock", "an embroidery machine"] },
  { name: "Kirana store", people: "Shopkeepers", purposes: ["shop inventory", "a refrigerator", "shop repairs"] },
  { name: "Agriculture", people: "Farmers", purposes: ["seeds and fertiliser", "a water pump", "drip irrigation"] },
  { name: "Goat rearing", people: "Goat rearers", purposes: ["four goats", "a goat shed", "fodder"] },
  { name: "Poultry", people: "Poultry farmers", purposes: ["chicks and feed", "a poultry shed"] },
  { name: "Handicrafts", people: "Artisans", purposes: ["bamboo and cane", "clay and a kiln", "craft tools"] },
  { name: "Vegetable vending", people: "Vegetable vendors", purposes: ["a push cart", "weighing scales", "stock"] },
  { name: "Fishing", people: "Fishers", purposes: ["a fishing net", "a boat engine", "ice boxes"] },
];

/** mulberry32: small, fast, seeded PRNG. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIRST_YEAR = 2019;
export const LAST_YEAR = 2026;
/** Loans in the current year run up to this month (0 = Jan). */
const LAST_MONTH = 9;

let cache: Borrower[] | null = null;

export function getBorrowers(): Borrower[] {
  if (cache) return cache;
  const rand = rng(31240);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  // More loans in later years: weight grows with the year.
  const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const weights = years.map((_, i) => 1 + i * 0.6);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const pickYear = () => {
    let r = rand() * weightSum;
    for (let i = 0; i < years.length; i++) {
      r -= weights[i];
      if (r <= 0) return years[i];
    }
    return LAST_YEAR;
  };

  const list: Borrower[] = [];
  for (let id = 0; id < TOTAL_BORROWERS; id++) {
    const live = pick(LIVELIHOODS);
    const year = pickYear();
    const r = rand();
    const outcome: Outcome = year >= LAST_YEAR - 1 && r < 0.6 ? "repaying" : r < 0.22 ? "second-loan" : "repaid";
    list.push({
      id,
      name: "",
      village: pick(VILLAGES),
      state: pick(STATES),
      livelihood: live.name,
      purpose: pick(live.purposes),
      year,
      month: Math.floor(rand() * (year === LAST_YEAR ? LAST_MONTH + 1 : 12)),
      amount: (4 + Math.floor(rand() * 17)) * 5000,
      tenure: pick([6, 9, 12, 12, 18, 24]),
      outcome,
      face: 0,
      tone: Math.floor(rand() * 3),
    });
  }

  // Gallery order: newest year first, newest month first. Every grouping keeps this order inside its sections.
  list.sort((a, b) => b.year - a.year || b.month - a.month || a.id - b.id);

  // Faces repeat across 31,000 borrowers, so in gallery order each one avoids the faces used just before it.
  const recent: number[] = [];
  for (const b of list) {
    let face: number;
    do face = Math.floor(rand() * FACE_COUNT);
    while (recent.includes(face));
    recent.push(face);
    if (recent.length > RECENT_FACES) recent.shift();
    const woman = rand() < 0.68;
    b.face = face;
    b.name = FACE_NAMES[face] ?? `${pick(woman ? WOMEN : MEN)} ${woman && rand() < 0.5 ? "Devi" : pick(SURNAMES)}`;
  }
  cache = list;
  return list;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  repaid: "Repaid in full",
  "second-loan": "Took a second loan",
  repaying: "Repaying",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRupees(n: number) {
  return `₹ ${n.toLocaleString("en-IN")}`;
}

export type GroupBy = "year" | "state" | "livelihood" | "outcome";

export type Section = { key: string; label: string; items: Borrower[] };

/** Groups borrowers into gallery sections, like Photos groups by date. */
export function groupBorrowers(list: Borrower[], by: GroupBy): Section[] {
  const map = new Map<string, Borrower[]>();
  for (const b of list) {
    const key = by === "year" ? String(b.year) : by === "state" ? b.state : by === "livelihood" ? b.livelihood : OUTCOME_LABEL[b.outcome];
    let bucket = map.get(key);
    if (!bucket) map.set(key, (bucket = []));
    bucket.push(b);
  }
  const sections = [...map.entries()].map(([key, items]) => ({ key, label: key, items }));
  // Items keep the list's gallery order (newest first), which the face shuffle is spread across.
  if (by === "year") {
    sections.sort((a, b) => Number(b.key) - Number(a.key));
  } else {
    // Biggest groups first.
    sections.sort((a, b) => b.items.length - a.items.length);
  }
  return sections;
}
