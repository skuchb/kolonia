import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = join(root, "public", "favicon.svg");
const background = "#12100e";

function run(args) {
  const result = spawnSync("npx", ["sharp-cli", ...args], { cwd: root, encoding: "utf8", shell: true });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(source)) {
  console.error("generate-pwa-icons: missing public/favicon.svg");
  process.exit(1);
}

mkdirSync(iconsDir, { recursive: true });

run(["resize", "192", "192", "-i", source, "-o", join(iconsDir, "icon-192.png")]);
run(["resize", "512", "512", "-i", source, "-o", join(iconsDir, "icon-512.png")]);

const inner = join(iconsDir, "_maskable-inner.png");
run(["resize", "410", "410", "-i", source, "-o", inner]);
run(["extend", "51", "51", "51", "51", "--background", background, "-i", inner, "-o", join(iconsDir, "icon-maskable-512.png")]);
rmSync(inner, { force: true });

console.log("generate-pwa-icons: wrote public/icons/icon-192.png, icon-512.png, icon-maskable-512.png");
