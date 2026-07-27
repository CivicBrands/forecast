import { spawnSync } from "node:child_process";

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

console.log("Publishing prime...");
run("git", ["push", "origin", "prime"]);

const commit = read("git", ["rev-parse", "--short=12", "HEAD"]);
const stamp = new Date()
  .toISOString()
  .replaceAll("-", "")
  .replaceAll(":", "")
  .replace(/\.\d{3}Z$/, "Z");
const tag = `deploy/${stamp}-${commit}`;

console.log(`Triggering GitHub deployment with ${tag}...`);
run("git", ["tag", tag, "HEAD"]);
run("git", ["push", "origin", `refs/tags/${tag}`]);

console.log(`GitHub now owns deployment of ${commit}.`);
