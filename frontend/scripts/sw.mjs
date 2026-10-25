/*
 * Emits dist/sw.js after `vite build`.
 *
 * The precache list is read from the build output instead of being written by
 * hand: asset names contain a content hash, so any list kept in source would be
 * wrong after the first commit. Scanning the directory also means a new icon in
 * public/ is picked up without anyone remembering to add it.
 *
 * The build id is a hash of that list plus this-worker's template, so the cache
 * name changes exactly when the deployment does.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const template = await readFile(join(root, "sw", "sw.js"), "utf8");

/** Every built file, as an absolute URL path, skipping the worker itself. */
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      if (!entry.isFile() || entry.name === "sw.js" || entry.name.endsWith(".map")) return [];
      return [`/${relative(dist, path).split("\\").join("/")}`];
    }),
  );
  return files.flat();
}

await stat(dist).catch(() => {
  throw new Error("dist/ is missing — run `vite build` first");
});

const precache = (await walk(dist)).sort();
const build = createHash("sha256")
  .update(precache.join("\n"))
  .update(template)
  .digest("hex")
  .slice(0, 10);

const source = template
  .replace('"__BUILD__"', JSON.stringify(build))
  .replace("__PRECACHE__", JSON.stringify(precache, null, 2));

await writeFile(join(dist, "sw.js"), source, "utf8");
console.log(`sw.js: ${precache.length} files, build ${build}`);
