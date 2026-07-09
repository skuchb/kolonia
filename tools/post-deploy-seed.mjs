import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function shouldSeedRemoteD1() {
  if (process.env.COLONIA_SEED_D1_REMOTE === "1") return true;
  if (process.env.CF_PAGES === "1") return true;
  if (process.env.CI === "true" && process.env.CLOUDFLARE_API_TOKEN) return true;
  return false;
}

function run(label, args) {
  console.log(`post-deploy-seed: ${label}`);
  const result = spawnSync("npm", args, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!shouldSeedRemoteD1()) {
  console.log("post-deploy-seed: skipped (not a production Cloudflare build)");
  process.exit(0);
}

run("running D1 migrations", ["run", "d1:migrate:remote"]);
run("importing CMS catalog to D1", ["run", "seed:d1:remote"]);
