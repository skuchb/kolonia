export type TeacherCategoryId =
  | "strength_dex"
  | "melee"
  | "ranged"
  | "magic"
  | "thief"
  | "hunting";

export type TradeCategoryId =
  | "melee_weapons"
  | "ranged_weapons"
  | "magic"
  | "alchemy"
  | "swamp_herbs"
  | "supplies";

const TEACHER_BY_NAME: Record<string, TeacherCategoryId> = {
  Diego: "strength_dex",
  Lares: "strength_dex",
  Lee: "strength_dex",
  "Cor Angar": "strength_dex",
  "Gor Na Toth": "strength_dex",
  Thorus: "strength_dex",
  Cord: "melee",
  Scatty: "melee",
  Cavalorn: "ranged",
  Skorpion: "ranged",
  "Baal Cadar": "magic",
  Corristo: "magic",
  Cronos: "magic",
  Saturas: "magic",
  Torrez: "magic",
  Xardas: "magic",
  Klin: "thief",
  Rączka: "thief",
  Aidan: "hunting",
  Buster: "hunting",
  Drax: "hunting",
  "Gor Na Drak": "hunting",
  "Strażnik Świątynny": "hunting",
  Tarrok: "hunting",
  Wilk: "hunting",
};

const TRADE_BY_NAME: Record<string, TradeCategoryId> = {
  Darrion: "melee_weapons",
  Fisk: "melee_weapons",
  Sharky: "melee_weapons",
  Skip: "melee_weapons",
  Skorpion: "melee_weapons",
  Cavalorn: "ranged_weapons",
  Wilk: "ranged_weapons",
  "Baal Cadar": "magic",
  Cronos: "magic",
  Torrez: "magic",
  Xardas: "magic",
  Alberto: "alchemy",
  Riordian: "alchemy",
  "Baal Isidro": "swamp_herbs",
  "Baal Kagan": "swamp_herbs",
  Fortuno: "swamp_herbs",
  Cipher: "supplies",
  Dexter: "supplies",
  Glen: "supplies",
  Graham: "supplies",
  Huno: "supplies",
  Mordrag: "supplies",
  Santino: "supplies",
  Silas: "supplies",
  Wąż: "supplies",
};

export function teacherCategoryForName(name: string): TeacherCategoryId | null {
  return TEACHER_BY_NAME[name] ?? null;
}

export function tradeCategoryForName(name: string): TradeCategoryId | null {
  return TRADE_BY_NAME[name] ?? null;
}
