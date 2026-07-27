import { spawnSync } from "node:child_process";

const GITHUB_REPOSITORY = "CivicBrands/forecast";
const WORKER_CHECK_NAME = "Workers Builds: forecast";
const WORKER_HEALTH_URL = "https://forecast.civicbrands.org/healthz";
const DEPLOY_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return options.capture ? result.stdout.trim() : "";
}

function read(command, args) {
  return run(command, args, { capture: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function workerCheck(commit) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${commit}/check-runs`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "civicbrands-forecast-deploy",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub check API returned ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();
  return payload.check_runs?.find((check) => check.name === WORKER_CHECK_NAME);
}

async function waitForWorkerDeployment(commit) {
  const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
  let previousState = "";

  while (Date.now() < deadline) {
    const check = await workerCheck(commit);
    const state = check
      ? `${check.status}${check.conclusion ? `/${check.conclusion}` : ""}`
      : "waiting-for-check";

    if (state !== previousState) {
      console.log(`Cloudflare deployment: ${state}`);
      previousState = state;
    }

    if (check?.status === "completed") {
      if (check.conclusion !== "success") {
        console.error(
          `Cloudflare deployment failed: ${check.details_url ?? "no details URL"}`,
        );
        process.exit(1);
      }
      return check;
    }

    await wait(POLL_INTERVAL_MS);
  }

  console.error(
    `Timed out after ${DEPLOY_TIMEOUT_MS / 60_000} minutes waiting for Cloudflare.`,
  );
  process.exit(1);
}

async function verifyWorkerHealth() {
  const response = await fetch(WORKER_HEALTH_URL, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.ok !== true) {
    console.error(
      `Worker health check failed with HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
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
  console.error(`Refusing to deploy through unexpected origin: ${origin}`);
  process.exit(2);
}

if (read("git", ["status", "--porcelain=v1"])) {
  console.error(
    "The working tree is dirty. Commit the complete on-disk source before deploying.",
  );
  process.exit(2);
}

console.log("Validating the full repository...");
run("npm", ["run", "verify:full"]);

if (read("git", ["status", "--porcelain=v1"])) {
  console.error("Validation changed tracked files. Commit or correct them first.");
  process.exit(2);
}

console.log("Refreshing origin/prime...");
run("git", ["fetch", "--prune", "origin", "prime"]);
run("git", ["merge-base", "--is-ancestor", "origin/prime", "HEAD"]);

const commit = read("git", ["rev-parse", "HEAD"]);
const remoteCommit = read("git", ["rev-parse", "origin/prime"]);
if (commit === remoteCommit) {
  console.error(
    "Nothing to deploy: local prime already matches origin/prime, so GitHub would emit no push event.",
  );
  process.exit(2);
}

console.log("Publishing prime...");
run("git", ["push", "origin", "prime"]);

console.log(`Waiting for Cloudflare Workers Builds to deploy ${commit.slice(0, 12)}...`);
const check = await waitForWorkerDeployment(commit);
await verifyWorkerHealth();
console.log(`Cloudflare deployment succeeded: ${check.details_url}`);
console.log(`${WORKER_HEALTH_URL} is healthy.`);
