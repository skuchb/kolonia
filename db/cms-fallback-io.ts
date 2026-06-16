import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CmsFallbackState } from "./cms-snapshot";

const FALLBACK_PATH = join(process.cwd(), "data-src/cms-fallback.json");

export function readCmsFallback(): CmsFallbackState {
  return JSON.parse(readFileSync(FALLBACK_PATH, "utf8")) as CmsFallbackState;
}

export function writeCmsFallback(state: CmsFallbackState) {
  writeFileSync(FALLBACK_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
