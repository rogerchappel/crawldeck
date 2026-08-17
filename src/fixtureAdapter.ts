import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CrawlAdapter, CrawlItem, CrawlJob, CrawlProfile, CrawlRunResult } from './types.js';

function resolveFixture(profile: CrawlProfile): string {
  return path.resolve(profile.fixturePath);
}

async function readFixtureItems(profile: CrawlProfile): Promise<CrawlItem[]> {
  const fixtureRoot = resolveFixture(profile);
  const manifestPath = path.join(fixtureRoot, 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || !Array.isArray(parsed.items)) {
    throw new Error(`Fixture manifest must contain an items array: ${manifestPath}`);
  }
  return parsed.items.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Fixture manifest item ${index + 1} must be an object: ${manifestPath}`);
    }
    if (typeof item.url !== 'string' || item.url.trim().length === 0) {
      throw new Error(
        `Fixture manifest item ${index + 1} has invalid url; expected a non-empty string: ${manifestPath}`
      );
    }
    if (item.title !== undefined && typeof item.title !== 'string') {
      throw new Error(
        `Fixture manifest item ${index + 1} has invalid title; expected a string when supplied: ${manifestPath}`
      );
    }
    if (item.body !== undefined && typeof item.body !== 'string') {
      throw new Error(
        `Fixture manifest item ${index + 1} has invalid body; expected a string when supplied: ${manifestPath}`
      );
    }
    const status = item.status ?? 200;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(
        `Fixture manifest item ${index + 1} has invalid status; expected an integer from 100 to 599: ${manifestPath}`
      );
    }
    return {
      url: item.url,
      title: item.title ?? `Untitled ${index + 1}`,
      status,
      body: item.body
    };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const fixtureAdapter: CrawlAdapter = {
  name: 'fixture',
  async inspect(profile) {
    return readFixtureItems(profile);
  },
  async run(profile: CrawlProfile, job: CrawlJob): Promise<CrawlRunResult> {
    const items = await readFixtureItems(profile);
    const outputDir = path.resolve(job.outputDir);
    await mkdir(outputDir, { recursive: true });
    const errors = items
      .filter((item) => item.status >= 400)
      .map((item) => `${item.status} ${item.url}`);
    const report = {
      jobId: job.id,
      profileId: profile.id,
      adapter: 'fixture',
      generatedAt: new Date().toISOString(),
      totalItems: items.length,
      okItems: items.filter((item) => item.status < 400).length,
      errorItems: errors.length,
      items
    };
    const reportPath = path.join(outputDir, `${job.id}-report.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { totalItems: items.length, processedItems: items.length, errors, reportPath };
  }
};
