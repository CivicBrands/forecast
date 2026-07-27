import { spawnSync } from "node:child_process";
import path from "node:path";

const WORKER_HEALTH_URL = "https://forecast.civicbrands.org/healthz";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
  return options.capture ? result.stdout.trim() : "";
}

function read(command, args) {
  return run(command, args, { capture: true });
}

async function verifyWorkerHealth() {
  const response = await fetch(WORKER_HEALTH_URL, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    console.error(`Worker health check failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    process.exit(1);
  }
}

const root = read("git", ["rev-parse", "--show-toplevel"]);
if (process.cwd() !== root) {
  console.error(`Run this command from the repository root: ${root}`);
  process.exit(2);
}

const branch = read("git", ["branch", "--show-current"]);
if (branch !== "prime") {
  console.error(`Production deployments must originate on prime, not ${branch}.`);
  process.exit(2);
}

const origin = read("git", ["remote", "get-url", "origin"]);
if (!/github\.com[/:]CivicBrands\/forecast(?:\.git)?$/.test(origin)) {
  console.error(`Refusing to save production state to unexpected origin: ${origin}`);
  process.exit(2);
}

if (read("git", ["status", "--porcelain=v1"])) {
  console.error("The working tree is dirty. Commit the complete on-disk source before deploying.");
  process.exit(2);
}

console.log("Validating the full repository...");
run("npm", ["run", "verify:full"]);

if (read("git", ["status", "--porcelain=v1"])) {
  console.error("Validation changed tracked files. Commit or correct them first.");
  process.exit(2);
}

console.log("Refreshing the shared GitHub base...");
run("git", ["fetch", "--prune", "origin", "prime"]);
run("git", ["merge-base", "--is-ancestor", "origin/prime", "HEAD"]);

const commit = read("git", ["rev-parse", "HEAD"]);
const remoteCommit = read("git", ["rev-parse", "origin/prime"]);
const directWrangler = path.join(root, "node_modules", "wrangler-direct", "bin", "wrangler.js");

console.log(`Deploying local commit ${commit.slice(0, 12)} directly to Cloudflare...`);
run(process.execPath, [directWrangler, "deploy"], { cwd: root });
await verifyWorkerHealth();
console.log(`${WORKER_HEALTH_URL} is healthy.`);

if (commit !== remoteCommit) {
  console.log("Saving the deployed commit to GitHub...");
  run("git", ["push", "origin", "prime"]);
} else {
  console.log("GitHub already has the deployed commit.");
}

console.log(`Direct deployment complete: ${commit}`);
