import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npcPath = join(root, "src/data/npc.json");
const quotesPath = join(root, "src/data/quotes.json");
const outPath = join(root, "data-src/cms-fallback.json");
const mapsDir = join(root, "public/maps");

const CURATED_CLASSIC = [
  "PC_Fighter",
  "GUR_1201_CorKalom",
  "GUR_1202_CorAngar",
  "KDF_404_Xardas",
  "VLK_538_Huno",
  "SLD_729_Kharim",
  "GUR_1204_BaalNamib",
  "ORG_700_Lester",
  "EBR_100_Gomez",
  "VLK_587_Garp",
  "GUR_1200_YBerion",
  "KDF_401_Pyrok",
  "SLD_700_Rod",
  "GUR_1211_BaalLukor",
];

const MAP_NPCS = [
  { npcId: "EBR_100_Gomez", x: 0.22, y: 0.38, chapterPl: "Rozdział 2", chapterEn: "Chapter 2", chapterDe: "Kapitel 2" },
  { npcId: "GUR_1201_CorKalom", x: 0.72, y: 0.55, chapterPl: "Rozdział 3", chapterEn: "Chapter 3", chapterDe: "Kapitel 3" },
  { npcId: "KDF_404_Xardas", x: 0.48, y: 0.28 },
  { npcId: "VLK_538_Huno", x: 0.35, y: 0.62 },
  { npcId: "SLD_729_Kharim", x: 0.58, y: 0.42 },
  { npcId: "GUR_1204_BaalNamib", x: 0.68, y: 0.48 },
  { npcId: "ORG_700_Lester", x: 0.52, y: 0.58 },
];

function now() {
  return Date.now();
}

function ensureMapSvg() {
  mkdirSync(mapsDir, { recursive: true });
  const svgPath = join(mapsDir, "kolonia.svg");
  if (existsSync(svgPath)) return;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#1a1410"/>
  <rect x="80" y="80" width="1040" height="640" fill="#2a2218" stroke="#8b6914" stroke-width="4"/>
  <text x="600" y="60" text-anchor="middle" fill="#c9a227" font-family="serif" font-size="36">KOLONIA</text>
  <ellipse cx="260" cy="300" rx="180" ry="120" fill="#3d4a2a" opacity="0.7"/>
  <text x="260" y="305" text-anchor="middle" fill="#d4c4a0" font-family="serif" font-size="18">Stary Obóz</text>
  <ellipse cx="600" cy="480" rx="200" ry="140" fill="#2a3a4a" opacity="0.7"/>
  <text x="600" y="485" text-anchor="middle" fill="#d4c4a0" font-family="serif" font-size="18">Nowy Obóz</text>
  <ellipse cx="860" cy="420" rx="160" ry="110" fill="#2a4a3a" opacity="0.7"/>
  <text x="860" y="425" text-anchor="middle" fill="#d4c4a0" font-family="serif" font-size="18">Bractwo</text>
</svg>`;
  writeFileSync(svgPath, svg, "utf8");
}

const npcs = JSON.parse(readFileSync(npcPath, "utf8"));
const quotes = JSON.parse(readFileSync(quotesPath, "utf8"));
const quoteByNpc = new Map();
for (const quote of quotes) {
  if (!quoteByNpc.has(quote.npcId)) quoteByNpc.set(quote.npcId, quote.id);
}

function quoteForNpc(npcId) {
  return quoteByNpc.get(npcId) ?? null;
}

const npcById = new Map(npcs.map((npc) => [npc.id, npc]));

ensureMapSvg();

const cmsNpcs = npcs.map((npc) => ({
  id: npc.id,
  dataJson: JSON.stringify(npc),
  enabled: 1,
  adminNote: null,
  updatedAt: now(),
}));

const cmsQuotes = quotes.map((quote) => ({
  id: quote.id,
  npcId: quote.npcId,
  dataJson: JSON.stringify(quote),
  enabled: 1,
  qualityStatus: "ok",
  adminNote: null,
  updatedAt: now(),
}));

const cmsMaps = [
  {
    id: "kolonia",
    name: "Kolonia",
    imageUrl: "/maps/kolonia.svg",
    imageWidth: 1024,
    imageHeight: 782,
    metersPerPixel: 2.5,
    defaultToleranceMeters: 80,
    active: 1,
    updatedAt: now(),
  },
];

const cmsMapPuzzles = MAP_NPCS.map((entry, index) => ({
  id: index + 1,
  mapId: "kolonia",
  npcId: entry.npcId,
  x: entry.x,
  y: entry.y,
  toleranceMeters: 80,
  chapterPl: entry.chapterPl ?? null,
  chapterEn: entry.chapterEn ?? null,
  chapterDe: entry.chapterDe ?? null,
  label: null,
  createdAt: now(),
}));

const dailyPuzzles = [];
for (let puzzle = 0; puzzle < 14; puzzle += 1) {
  const classicId = CURATED_CLASSIC[puzzle % CURATED_CLASSIC.length];
  const quoteId = quoteForNpc(classicId);
  const mapPuzzleId = (puzzle % MAP_NPCS.length) + 1;
  const classicNpc = npcById.get(classicId);

  if (classicNpc) {
    dailyPuzzles.push({
      puzzle,
      mode: "classic",
      npcId: classicId,
      quoteId: null,
      mapPuzzleId: null,
      published: 1,
    });
  }

  if (quoteId) {
    const quote = quotes.find((entry) => entry.id === quoteId);
    if (quote) {
      dailyPuzzles.push({
        puzzle,
        mode: "quote",
        npcId: quote.npcId,
        quoteId: quote.id,
        mapPuzzleId: null,
        published: 1,
      });
    }
  }

  dailyPuzzles.push({
    puzzle,
    mode: "map",
    npcId: MAP_NPCS[puzzle % MAP_NPCS.length].npcId,
    quoteId: null,
    mapPuzzleId,
    published: 1,
  });
}

const payload = {
  npcs: cmsNpcs,
  quotes: cmsQuotes,
  maps: cmsMaps,
  mapPuzzles: cmsMapPuzzles,
  dailyPuzzles,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`seed-content: wrote ${outPath}`);
console.log(`  npcs: ${cmsNpcs.length}`);
console.log(`  quotes: ${cmsQuotes.length}`);
console.log(`  daily puzzles: ${dailyPuzzles.length}`);
console.log(`  map puzzles: ${cmsMapPuzzles.length}`);
