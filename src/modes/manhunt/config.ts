import type { ManhuntFieldId } from "./types";

export const MANHUNT_CONFIG = {
  budget: 14,
  missCost: 1,
  xp: { base: 50, perNugget: 100, levelStep: 500 },
  freeFields: ["camp"] as ManhuntFieldId[],
  fields: [
    { id: "guild" as const, cost: 2 },
    { id: "location" as const, cost: 3 },
    { id: "letter" as const, cost: 3 },
    { id: "teacher" as const, cost: 1 },
    { id: "trade" as const, cost: 1 },
    { id: "quote" as const, cost: 5 },
  ],
} as const;

const paidSum = MANHUNT_CONFIG.fields.reduce((sum, field) => sum + field.cost, 0);
if (paidSum <= 0) {
  throw new Error("manhunt: paid field costs must be positive");
}
