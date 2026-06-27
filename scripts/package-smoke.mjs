#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

const [packument] = JSON.parse(output);
const packedFiles = new Set(packument.files.map((file) => file.path));
const requiredFiles = new Set(["README.md", "LICENSE"]);

if (packageJson.main) {
  requiredFiles.add(packageJson.main.replace(/^\.\//, ""));
}

const binEntries =
  typeof packageJson.bin === "string"
    ? [packageJson.bin]
    : Object.values(packageJson.bin ?? {});

for (const binEntry of binEntries) {
  requiredFiles.add(binEntry.replace(/^\.\//, ""));
}

const missing = [...requiredFiles].filter((file) => !packedFiles.has(file));

if (missing.length > 0) {
  console.error(`${packageJson.name} package smoke failed; missing packed file(s):`);
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`${packageJson.name} package smoke passed with ${packument.files.length} packed file(s).`);
