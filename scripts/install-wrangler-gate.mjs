import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binDirectory = path.join(root, "node_modules", ".bin");
const gate = path.join(
  root,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

await lstat(gate);
await mkdir(binDirectory, { recursive: true });

for (const name of ["wrangler", "wrangler2", "cf-wrangler"]) {
  const link = path.join(binDirectory, name);
  await rm(link, { force: true });
  await symlink(path.relative(binDirectory, gate), link);
}
