#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const expectedTag = process.argv[2];
if (!expectedTag) {
  console.error('usage: node scripts/check-release-tag.mjs <expected-tag>');
  process.exit(2);
}

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageTag = `v${packageJson.version}`;

if (expectedTag !== packageTag) {
  console.error(`release tag ${expectedTag} does not match package version tag ${packageTag}`);
  process.exit(1);
}

console.log(`release tag ${expectedTag} matches package version ${packageJson.version}`);
