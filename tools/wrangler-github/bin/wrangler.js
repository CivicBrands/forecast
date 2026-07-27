#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const args = process.argv.slice(2);
const root = path.resolve(__dirname, "../../..");
const directWrangler = path.join(
  root,
  "node_modules",
  "wrangler-direct",
  "bin",
  "wrangler.js",
);

if (args[0] !== "deploy" || args.includes("--dry-run")) {
  const result = spawnSync(process.execPath, [directWrangler, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

if (args.length !== 1) {
  console.error(
    "Production deployment is GitHub-controlled and accepts no local Wrangler flags.",
  );
  console.error("Use `npx wrangler deploy` from the repository root.");
  process.exit(2);
}

const deployScript = path.join(root, "scripts", "deploy-via-github.mjs");
const result = spawnSync(process.execPath, [deployScript], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
