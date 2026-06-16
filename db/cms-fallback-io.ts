import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import cmsFallback from "../data-src/cms-fallback.json";
import type { CmsFallbackState } from "./cms-snapshot";

const FALLBACK_PATH = join(process.cwd(), "data-src/cms-fallback.json");

export function readCmsFallback(): CmsFallbackState {
  return JSON.parse(readFileSync(FALLBACK_PATH, "utf8")) as CmsFallbackState;
}

export function resolveCmsFallback(): CmsFallbackState {
  if (isNodeRuntime()) {
    try {
      return readCmsFallback();
    } catch {
      // Bundled fallback for non-standard Node cwd or missing file.
    }
  }
  return cmsFallback as CmsFallbackState;
}

export function writeCmsFallback(state: CmsFallbackState) {
  writeFileSync(FALLBACK_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
