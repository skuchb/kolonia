import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "VaanaCZ/gothic-1-classic-scripts";
const STORY_ROOT = "_work/Data/Scripts/Content/Story";
const SOURCE_BRANCHES = {
  pl: "Unified-PL",
  en: "Unified-EN",
  de: "Unified-DE",
};
const LOCALES = Object.keys(SOURCE_BRANCHES);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "data-src/g1");
const npcPath = join(root, "src/data/npc.json");
const quotesPath = join(root, "src/data/quotes.json");
const summaryPath = join(root, "data-src/g1-summary.json");
const refresh = process.argv.includes("--refresh");

const GUILD_FAMILIES = {
  GIL_EBR: "OLD_CAMP",
  GIL_GRD: "OLD_CAMP",
  GIL_STT: "OLD_CAMP",
  GIL_VLK: "OLD_CAMP",
  GIL_KDF: "FIRE_MAGES",
  GIL_KDW: "WATER_MAGES",
  GIL_SLD: "NEW_CAMP",
  GIL_ORG: "NEW_CAMP",
  GIL_BAU: "NEW_CAMP",
  GIL_SFB: "FREE_MINE",
  GIL_GUR: "SWAMP_CAMP",
  GIL_NOV: "SWAMP_CAMP",
  GIL_TPL: "SWAMP_CAMP",
  GIL_DMB: "CREATURES",
  GIL_ORC: "ORCS",
  GIL_NONE: "NONE",
};

const SCRIPT_PATHS = [
  `${STORY_ROOT}/NPC/`,
  `${STORY_ROOT}/Missions/`,
  `${STORY_ROOT}/B/`,
  `${STORY_ROOT}/SVM.d`,
  `${STORY_ROOT}/Text.d`,
  `${STORY_ROOT}/Startup.d`,
];

const CANONICAL_DUPLICATE_NPC_IDS = new Set([
  // Technical duplicate instances for actual story characters.
  "KDF_404_Xardas",
  "PC_Fighter",
]);

const NON_STORY_QUOTE_PATTERN =
  /(trade|buy|sell|teach|train|learn|betterarmor|armor|refusetrain|pleaseTeachSTR|wherelearn)/i;

// Canonical teacher list from https://gothic.fandom.com/pl/wiki/Nauczyciele_w_Gothic.
// Kept as an explicit override because not every teacher uses B_BuildLearnString in scripts.
const MANUAL_TEACHER_NPC_IDS = new Set([
  "GUR_1202_CorAngar",
  "PC_Thief",
  "PC_Fighter",
  "TPL_1402_GorNaToth",
  "ORG_801_Lares",
  "SLD_700_Lee",
  "GRD_200_Thorus",
  "ORG_855_Wolf",
  "GUR_1208_BaalCadar",
  "KDW_604_Cronos",
  "KDF_402_Corristo",
  "KDF_405_Torrez",
  "SLD_709_Cord",
  "GRD_210_Scatty",
  "STT_336_Cavalorn",
  "GRD_205_Scorpio",
  "KDW_600_Saturas",
  "KDF_404_Xardas",
  "ORG_850_Wedge",
  "STT_331_Fingers",
  "ORG_833_Buster",
  "ORG_859_Aidan",
  "ORG_819_Drax",
  "TPL_1439_GorNaDrak",
  "TPL_1438_Templer",
]);

function fail(message) {
  console.error(`build-data: ${message}`);
  process.exit(1);
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function slug(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function pathToRawUrl(branch, path) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${REPO}/${branch}/${encoded}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "kolonia-data-builder",
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function fetchScriptFile(branch, path) {
  const response = await fetch(pathToRawUrl(branch, path), {
    headers: { "User-Agent": "kolonia-data-builder" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${path}`);
  }
  const bytes = await response.arrayBuffer();
  return normalizeNewlines(new TextDecoder("utf-8").decode(bytes));
}

function shouldCachePath(path) {
  return SCRIPT_PATHS.some((prefix) => path === prefix || path.startsWith(prefix));
}

async function ensureBranchCache(locale, branch) {
  const branchDir = join(cacheDir, branch);
  if (refresh && existsSync(branchDir)) {
    rmSync(branchDir, { recursive: true, force: true });
  }

  if (existsSync(join(branchDir, STORY_ROOT, "NPC"))) {
    return;
  }

  console.log(`build-data: downloading ${branch} scripts`);
  const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/${branch}:${STORY_ROOT}?recursive=1`;
  const tree = JSON.parse(await fetchText(treeUrl));
  if (!Array.isArray(tree.tree)) fail(`could not read GitHub tree for ${branch}`);

  const files = tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => `${STORY_ROOT}/${entry.path}`)
    .filter(shouldCachePath);

  for (const [index, path] of files.entries()) {
    const targetPath = join(branchDir, path);
    mkdirSync(dirname(targetPath), { recursive: true });
    const content = await fetchScriptFile(branch, path);
    writeFileSync(targetPath, content, "utf8");
    if ((index + 1) % 100 === 0) {
      console.log(`build-data: ${branch} ${index + 1}/${files.length}`);
    }
  }

  console.log(`build-data: cached ${files.length} files for ${branch} (${locale})`);
}

function readCached(locale, storyPath) {
  const branch = SOURCE_BRANCHES[locale];
  return readFileSync(join(cacheDir, branch, storyPath), "utf8");
}

function listCachedFiles(locale, subdir) {
  const branch = SOURCE_BRANCHES[locale];
  const base = join(cacheDir, branch, STORY_ROOT, subdir);
  const result = [];
  const stack = [base];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;
    for (const name of requireDirectoryNames(current)) {
      const fullPath = join(current, name.name);
      if (name.isDirectory()) {
        stack.push(fullPath);
      } else if (name.isFile() && name.name.toLowerCase().endsWith(".d")) {
        result.push(`${STORY_ROOT}/${subdir}/${relative(base, fullPath).replaceAll("\\", "/")}`);
      }
    }
  }

  return result.sort();
}

function requireDirectoryNames(path) {
  return readdirSync(path, { withFileTypes: true });
}

function parseStringConstants(content) {
  const constants = new Map();
  for (const match of stripComments(content).matchAll(/\bconst\s+string\s+([A-Za-z0-9_]+)\s*=\s*"([^"]*)"\s*;/gi)) {
    constants.set(match[1].toUpperCase(), match[2]);
  }
  return constants;
}

function readBalancedBlock(content, startIndex) {
  const openIndex = content.indexOf("{", startIndex);
  if (openIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = openIndex; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          body: content.slice(openIndex + 1, index),
          endIndex: index + 1,
        };
      }
    }
  }

  return null;
}

function extractInstances(content) {
  const instances = [];
  const pattern = /\bINSTANCE\s+([A-Za-z0-9_]+)\s*\(\s*([A-Za-z0-9_]+)\s*\)/gi;
  let match;

  while ((match = pattern.exec(content))) {
    if (!/^npc_default$/i.test(match[2])) continue;
    const block = readBalancedBlock(content, match.index);
    if (!block) continue;
    instances.push({
      id: canonicalInstance(match[1]),
      body: block.body,
    });
    pattern.lastIndex = block.endIndex;
  }

  return instances;
}

function canonicalInstance(value) {
  return value
    .split("_")
    .map((part, index) => {
      if (index === 0 || /^\d+$/.test(part) || part === part.toUpperCase()) return part.toUpperCase();
      return `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
    })
    .join("_");
}

function readAssignment(body, field) {
  const match = stripComments(body).match(new RegExp(`\\b${field}\\s*=\\s*([^;]+);`, "i"));
  return match?.[1]?.trim() ?? null;
}

function readNumberAssignment(body, field) {
  const value = readAssignment(body, field);
  if (!value) return null;
  const number = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function resolveName(expression, constants) {
  if (!expression) return "";
  const literal = expression.match(/"([^"]*)"/);
  if (literal) return literal[1];
  return constants.get(expression.trim().toUpperCase()) ?? expression.trim();
}

function parseKeyedNumbers(body, field) {
  const values = {};
  const clean = stripComments(body);
  const pattern = new RegExp(`\\b${field}\\s*\\[\\s*([A-Za-z0-9_]+)\\s*\\]\\s*=\\s*(-?\\d+)\\s*;`, "gi");
  for (const match of clean.matchAll(pattern)) {
    values[match[1]] = Number(match[2]);
  }
  return values;
}

function parseTalents(body) {
  const talents = [];
  const clean = stripComments(body);
  for (const match of clean.matchAll(/\bNpc_SetTalentSkill\s*\(\s*self\s*,\s*([A-Za-z0-9_]+)\s*,\s*(\d+)\s*\)/gi)) {
    talents.push({ id: match[1], skill: Number(match[2]) });
  }
  return talents;
}

function parseInventory(body) {
  const items = [];
  const clean = stripComments(body);
  const pattern = /\b(EquipItem|CreateInvItem|CreateInvItems)\s*\(\s*self\s*,\s*([A-Za-z0-9_]+)(?:\s*,\s*(\d+))?\s*\)/gi;
  for (const match of clean.matchAll(pattern)) {
    items.push({
      action: match[1],
      item: match[2],
      count: match[3] ? Number(match[3]) : 1,
    });
  }
  return items;
}

function parseFunctions(content) {
  const functions = [];
  const pattern = /\bFUNC\s+(?:VOID|INT|string|float)\s+([A-Za-z0-9_]+)\s*\([^)]*\)/gi;
  let match;

  while ((match = pattern.exec(content))) {
    const block = readBalancedBlock(content, match.index);
    if (!block) continue;
    functions.push({ name: match[1], body: block.body });
    pattern.lastIndex = block.endIndex;
  }

  return functions;
}

function formatTime(hour, minute) {
  return `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
}

function parseRoutineSlots(functions, originalId) {
  const suffix = originalId == null ? "" : `_${originalId}`;
  return functions
    .filter((routine) => !suffix || routine.name.endsWith(suffix))
    .map((routine) => {
      const slots = [];
      const pattern = /\bTA_([A-Za-z0-9_]+)\s*\(\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*"([^"]+)"\s*\)\s*;\s*(?:(?:\/\/)(.*))?/gi;
      for (const match of routine.body.matchAll(pattern)) {
        slots.push({
          activity: `TA_${match[1]}`,
          from: formatTime(match[2], match[3]),
          to: formatTime(match[4], match[5]),
          waypoint: match[6],
          ...(match[7]?.trim() ? { note: match[7].trim() } : {}),
        });
      }
      return { name: routine.name, slots };
    })
    .filter((routine) => routine.slots.length > 0);
}

function parseStartupPlacements(content) {
  const placements = new Map();
  const pattern = /\bWld_InsertNpc\s*\(\s*([A-Za-z0-9_]+)\s*,\s*"([^"]+)"\s*\)\s*;\s*(?:(?:\/\/)(.*))?/gi;
  for (const match of content.matchAll(pattern)) {
    const id = canonicalInstance(match[1]);
    const entry = {
      waypoint: match[2],
      ...(match[3]?.trim() ? { note: match[3].trim() } : {}),
    };
    const list = placements.get(id) ?? [];
    list.push(entry);
    placements.set(id, list);
  }
  return placements;
}

function parseTeachingRoutineNpcIds(npcs) {
  return new Set(
    npcs
      .filter((npc) =>
        npc.routines.some((routine) =>
          routine.slots.some((slot) => slot.activity.toUpperCase() === "TA_TEACHING"),
        ),
      )
      .map((npc) => npc.id),
  );
}

function parseTrainingDialogNpcIds(contents) {
  const teacherIds = new Set();

  for (const content of contents.values()) {
    const functions = new Map(parseFunctions(content).map((fn) => [fn.name.toUpperCase(), fn.body]));
    const pattern = /\bINSTANCE\s+([A-Za-z0-9_]+)\s*\(\s*C_INFO\s*\)/gi;
    let match;

    while ((match = pattern.exec(content))) {
      const block = readBalancedBlock(content, match.index);
      if (!block) continue;

      const npc = readAssignment(block.body, "npc");
      const information = readAssignment(block.body, "information");
      const informationBody = information ? functions.get(information.toUpperCase()) ?? "" : "";

      if (npc && /\bB_BuildLearnString\s*\(/i.test(informationBody)) {
        teacherIds.add(canonicalInstance(npc));
      }

      pattern.lastIndex = block.endIndex;
    }
  }

  return teacherIds;
}

function locationArea(location) {
  if (!location) return "";
  const [first, second] = location.split("_");
  if (first === "LOCATION" && second) return `${first}_${second}`;
  return first;
}

function talentIds(npc) {
  return new Set(npc.talents.map((talent) => talent.id.toUpperCase()));
}

function inventoryIds(npc) {
  return new Set(npc.inventory.map((entry) => entry.item.toUpperCase()));
}

function deriveCombatStyle(npc) {
  const talents = talentIds(npc);
  const inventory = inventoryIds(npc);
  const hasRune = [...inventory].some((item) => item.includes("RUNE"));

  if (talents.has("NPC_TALENT_MAGE") || hasRune) return "MAGIC";
  if (talents.has("NPC_TALENT_CROSSBOW")) return "CROSSBOW";
  if (talents.has("NPC_TALENT_BOW")) return "BOW";
  if (talents.has("NPC_TALENT_2H")) return "TWO_H";
  if (talents.has("NPC_TALENT_1H")) return "ONE_H";
  return "NON_COMBAT";
}

function deriveRole(npc) {
  const id = npc.id.toUpperCase();
  const guild = npc.guild.toUpperCase();
  const name = npc.name.toLowerCase();

  if (npc.npctype.toUpperCase().includes("FRIEND")) return "FRIEND";
  if (id.includes("XARDAS")) return "MAGE";
  if (guild === "GIL_EBR") return "ORE_BARON";
  if (guild === "GIL_KDF") return "FIRE_MAGE";
  if (guild === "GIL_KDW") return "WATER_MAGE";
  if (guild === "GIL_GUR") return "GURU";
  if (guild === "GIL_TPL") return "TEMPLAR";
  if (guild === "GIL_NOV") return name.startsWith("baal ") ? "GURU" : "NOVICE";
  if (guild === "GIL_GRD") return "GUARD";
  if (guild === "GIL_STT") return "SHADOW";
  if (guild === "GIL_SLD") return "MERCENARY";
  if (guild === "GIL_ORG") return "ROGUE";
  if (guild === "GIL_BAU") return "PEASANT";
  if (guild === "GIL_SFB") return "MINER";
  if (guild.includes("ORC")) return "ORC";

  if (deriveCombatStyle(npc) === "MAGIC") return "MAGE";
  return "OUTSIDER";
}

function parseNpcFile(content, constants, sourcePath) {
  const functions = parseFunctions(content);
  return extractInstances(content).map((instance) => {
    const originalId = readNumberAssignment(instance.body, "id");
    const routines = parseRoutineSlots(functions, originalId);
    const startupLocations = [];
    const routineLocation = routines.flatMap((routine) => routine.slots)[0]?.waypoint ?? null;
    const guild = readAssignment(instance.body, "guild") ?? "GIL_NONE";
    const nameExpression = readAssignment(instance.body, "name");

    const npc = {
      id: instance.id,
      sourceFile: sourcePath,
      name: resolveName(nameExpression, constants),
      nameExpression,
      guild,
      guildFamily: GUILD_FAMILIES[guild] ?? guild,
      npctype: readAssignment(instance.body, "npctype") ?? "NPCTYPE_UNKNOWN",
      level: readNumberAssignment(instance.body, "level") ?? 0,
      voice: readNumberAssignment(instance.body, "voice") ?? null,
      originalId,
      flags: readAssignment(instance.body, "flags"),
      fightTactic: readAssignment(instance.body, "fight_tactic"),
      dailyRoutine: readAssignment(instance.body, "daily_routine"),
      attributes: parseKeyedNumbers(instance.body, "attribute"),
      protection: parseKeyedNumbers(instance.body, "protection"),
      talents: parseTalents(instance.body),
      inventory: parseInventory(instance.body),
      routines,
      startupLocations,
      location: routineLocation ?? "UNKNOWN",
      locationArea: locationArea(routineLocation ?? "UNKNOWN"),
    };

    return {
      ...npc,
      role: deriveRole(npc),
      combatStyle: deriveCombatStyle(npc),
    };
  });
}

function mergeNpcLocales(npcByLocale, startupPlacements, teacherIds) {
  const base = npcByLocale.pl;
  const byLocaleId = Object.fromEntries(LOCALES.map((locale) => [locale, new Map(npcByLocale[locale].map((npc) => [npc.id, npc]))]));

  return base.map((npc) => {
    const localizedName = Object.fromEntries(
      LOCALES.map((locale) => [locale, byLocaleId[locale].get(npc.id)?.name || npc.name]),
    );
    const startupLocations = startupPlacements.get(npc.id) ?? [];
    const startupLocation = startupLocations[0]?.waypoint ?? null;
    const location = startupLocation ?? npc.location;
    return {
      ...npc,
      name: localizedName.pl,
      names: localizedName,
      aliases: [npc.id, localizedName.en, localizedName.de].filter((value, index, list) => value && list.indexOf(value) === index),
      startupLocations,
      location,
      locationArea: locationArea(location),
      isTeacher: teacherIds.has(npc.id),
      isFriend: npc.npctype.toUpperCase().includes("FRIEND"),
    };
  });
}

function parseInfoNpcMap(content, fallbackNpcId) {
  const map = new Map();
  const pattern = /\bINSTANCE\s+([A-Za-z0-9_]+)\s*\(\s*C_INFO\s*\)/gi;
  let match;

  while ((match = pattern.exec(content))) {
    const block = readBalancedBlock(content, match.index);
    if (!block) continue;
    const npc = readAssignment(block.body, "npc");
    const information = readAssignment(block.body, "information");
    const npcId = npc ?? fallbackNpcId;
    if (information && npcId) {
      map.set(information, canonicalInstance(npcId));
    }
    pattern.lastIndex = block.endIndex;
  }

  return map;
}

function fallbackNpcFromDialoguePath(path) {
  const filename = path.split("/").pop()?.replace(/\.d$/i, "") ?? "";
  if (filename.startsWith("DIA_")) return canonicalInstance(filename.slice(4));
  return null;
}

function outputSpeaker(rawSpeaker) {
  const speaker = rawSpeaker.toLowerCase();
  if (speaker === "self") return "npc";
  return "hero";
}

function parseOutputsByFunction(content) {
  const outputs = new Map();
  for (const fn of parseFunctions(content)) {
    const lines = [];
    const pattern = /\bAI_Output\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*,\s*"([^"]+)"\s*\)\s*;\s*(?:(?:\/\/)(.*))?/gi;
    for (const match of fn.body.matchAll(pattern)) {
      const text = match[4]?.trim();
      if (!text) continue;
      lines.push({
        outputId: match[3],
        speaker: outputSpeaker(match[1]),
        text,
      });
    }
    if (lines.length > 0) outputs.set(fn.name, lines);
  }
  return outputs;
}

function dialoguePaths(locale) {
  return [
    ...listCachedFiles(locale, "Missions"),
    ...listCachedFiles(locale, "B"),
  ];
}

function quoteId(path, firstOutputId, offset) {
  return `${slug(path.replace(`${STORY_ROOT}/`, "").replace(/\.d$/i, ""))}_${slug(firstOutputId)}_${offset}`;
}

function normalizeSpoilerText(value) {
  return ` ${value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function quoteContainsNpcName(npc, chunksByLocale) {
  const names = new Set(
    [
      npc.name,
      npc.names?.pl,
      npc.names?.en,
      npc.names?.de,
      ...(npc.aliases ?? []),
    ].filter((value) => typeof value === "string" && value.length >= 3 && value !== npc.id),
  );

  const terms = [...names].map(normalizeSpoilerText).filter((term) => term.trim().length >= 3);
  if (terms.length === 0) return false;

  return LOCALES.some((locale) => {
    const text = normalizeSpoilerText(chunksByLocale[locale].map((line) => line.text).join(" "));
    return terms.some((term) => text.includes(term));
  });
}

function generatedQuoteContainsNpcName(npc, quote) {
  return quoteContainsNpcName(npc, {
    pl: quote.lines.map((line) => ({ text: line.text.pl })),
    en: quote.lines.map((line) => ({ text: line.text.en })),
    de: quote.lines.map((line) => ({ text: line.text.de })),
  });
}

function validateGeneratedQuotes(quotes, npcById) {
  const spoilers = quotes.filter((quote) => {
    const npc = npcById.get(quote.npcId);
    return npc ? generatedQuoteContainsNpcName(npc, quote) : false;
  });

  if (spoilers.length > 0) {
    fail(`found ${spoilers.length} quote(s) that reveal the target NPC name, e.g. "${spoilers[0].id}"`);
  }
}

function normalizedStoryName(npc) {
  return normalizeSpoilerText(npc.name).trim();
}

function duplicateStoryNameCounts(npcs) {
  const counts = new Map();
  for (const npc of npcs) {
    const name = normalizedStoryName(npc);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function isStoryNpcCandidate(npc, duplicateNameCounts) {
  if (CANONICAL_DUPLICATE_NPC_IDS.has(npc.id)) return true;

  const duplicateCount = duplicateNameCounts.get(normalizedStoryName(npc)) ?? 0;
  if (duplicateCount > 1) return false;

  if (MANUAL_TEACHER_NPC_IDS.has(npc.id)) return true;

  const type = npc.npctype.toUpperCase();
  if (type.includes("AMBIENT") || type.includes("GUARD") || type.includes("MINE")) return false;

  return true;
}

function isStoryQuoteCandidate(quote) {
  if (NON_STORY_QUOTE_PATTERN.test(quote.sourceFunction)) return false;
  if (NON_STORY_QUOTE_PATTERN.test(quote.outputIds.join(" "))) return false;
  return true;
}

function curateStoryData(npcs, quotes) {
  const duplicateNameCounts = duplicateStoryNameCounts(npcs);
  const storyCandidateIds = new Set(
    npcs.filter((npc) => isStoryNpcCandidate(npc, duplicateNameCounts)).map((npc) => npc.id),
  );

  const storyQuotes = quotes.filter(
    (quote) => storyCandidateIds.has(quote.npcId) && isStoryQuoteCandidate(quote),
  );
  const npcIdsWithQuotes = new Set(storyQuotes.map((quote) => quote.npcId));
  const storyNpcs = npcs.filter((npc) => npcIdsWithQuotes.has(npc.id) || MANUAL_TEACHER_NPC_IDS.has(npc.id));

  return {
    npcs: storyNpcs,
    quotes: storyQuotes,
    removedNpcCount: npcs.length - storyNpcs.length,
    removedQuoteCount: quotes.length - storyQuotes.length,
    duplicateNameCount: [...duplicateNameCounts.values()].filter((count) => count > 1).length,
  };
}

function mergeQuotesByLocale(contentsByLocale, npcById) {
  const quoteMap = new Map();
  const paths = dialoguePaths("pl");

  for (const path of paths) {
    const fallbackNpcId = fallbackNpcFromDialoguePath(path);
    const perLocale = Object.fromEntries(
      LOCALES.map((locale) => [locale, contentsByLocale[locale].get(path)]),
    );
    if (!perLocale.pl || !perLocale.en || !perLocale.de) continue;

    const infoNpcMap = parseInfoNpcMap(perLocale.pl, fallbackNpcId);
    const outputsByLocale = Object.fromEntries(
      LOCALES.map((locale) => [locale, parseOutputsByFunction(perLocale[locale])]),
    );

    for (const [functionName, plLines] of outputsByLocale.pl.entries()) {
      const npcId = canonicalInstance(infoNpcMap.get(functionName) ?? fallbackNpcId ?? "");
      const npc = npcById.get(npcId);
      if (!npc) continue;

      const enLines = outputsByLocale.en.get(functionName);
      const deLines = outputsByLocale.de.get(functionName);
      if (!enLines || !deLines) continue;

      const lineCount = Math.min(plLines.length, enLines.length, deLines.length);
      for (let offset = 0; offset < lineCount; offset += 4) {
        const chunkLength = Math.min(4, lineCount - offset);
        const plChunk = plLines.slice(offset, offset + chunkLength);
        const enChunk = enLines.slice(offset, offset + chunkLength);
        const deChunk = deLines.slice(offset, offset + chunkLength);
        if (!plChunk.some((line) => line.speaker === "npc")) continue;
        if (quoteContainsNpcName(npc, { pl: plChunk, en: enChunk, de: deChunk })) continue;

        const id = quoteId(path, plChunk[0].outputId, offset);
        quoteMap.set(id, {
          id,
          npcId,
          sourceFile: path,
          sourceFunction: functionName,
          outputIds: plChunk.map((line) => line.outputId),
          lines: plChunk.map((line, index) => ({
            speaker: line.speaker,
            text: {
              pl: line.text,
              en: enChunk[index]?.text ?? "",
              de: deChunk[index]?.text ?? "",
            },
          })),
          context: {
            pl: "Oryginalny dialog z Gothic 1.",
            en: "Original Gothic 1 dialogue.",
            de: "Originaldialog aus Gothic 1.",
          },
        });
      }
    }
  }

  return [...quoteMap.values()].sort((left, right) => left.id.localeCompare(right.id));
}

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  for (const [locale, branch] of Object.entries(SOURCE_BRANCHES)) {
    await ensureBranchCache(locale, branch);
  }

  const constantsByLocale = Object.fromEntries(
    LOCALES.map((locale) => [locale, parseStringConstants(readCached(locale, `${STORY_ROOT}/Text.d`))]),
  );
  const startupPlacements = parseStartupPlacements(readCached("pl", `${STORY_ROOT}/Startup.d`));

  const npcByLocale = Object.fromEntries(
    LOCALES.map((locale) => {
      const npcs = listCachedFiles(locale, "NPC").flatMap((path) =>
        parseNpcFile(readCached(locale, path), constantsByLocale[locale], path),
      );
      return [locale, npcs.sort((left, right) => left.id.localeCompare(right.id))];
    }),
  );

  const contentsByLocale = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      new Map(dialoguePaths(locale).map((path) => [path, readCached(locale, path)])),
    ]),
  );
  const teacherIds = new Set([
    ...MANUAL_TEACHER_NPC_IDS,
    ...parseTeachingRoutineNpcIds(npcByLocale.pl),
    ...parseTrainingDialogNpcIds(contentsByLocale.pl),
  ]);
  const rawNpcs = mergeNpcLocales(npcByLocale, startupPlacements, teacherIds);
  const rawNpcById = new Map(rawNpcs.map((npc) => [npc.id, npc]));

  const rawQuotes = mergeQuotesByLocale(contentsByLocale, rawNpcById);
  validateGeneratedQuotes(rawQuotes, rawNpcById);

  const curated = curateStoryData(rawNpcs, rawQuotes);
  const npcs = curated.npcs;
  const quotes = curated.quotes;

  if (npcs.length < 80) fail(`expected at least 80 story NPC from Gothic scripts, got ${npcs.length}`);
  if (quotes.length < 400) fail(`expected at least 400 story dialogue quotes, got ${quotes.length}`);

  writeFileSync(npcPath, `${JSON.stringify(npcs, null, 2)}\n`, "utf8");
  writeFileSync(quotesPath, `${JSON.stringify(quotes, null, 2)}\n`, "utf8");
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        source: `https://github.com/${REPO}`,
        branches: SOURCE_BRANCHES,
        generatedAt: new Date().toISOString(),
        npcCount: npcs.length,
        quoteCount: quotes.length,
        rawNpcCount: rawNpcs.length,
        rawQuoteCount: rawQuotes.length,
        removedNpcCount: curated.removedNpcCount,
        removedQuoteCount: curated.removedQuoteCount,
        duplicateNameCount: curated.duplicateNameCount,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `build-data: OK - ${npcs.length} story NPC, ${quotes.length} story quotes ` +
      `(removed ${curated.removedNpcCount} NPC, ${curated.removedQuoteCount} quotes)`,
  );
}

main().catch((error) => fail(error.message));
