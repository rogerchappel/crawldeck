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
  const parsed = JSON.parse(raw) as { items?: CrawlItem[] };
  if (!Array.isArray(parsed.items)) {
    throw new Error(`Fixture manifest must contain an items array: ${manifestPath}`);
  }
  return parsed.items.map((item, index) => ({
    url: String(item.url ?? `fixture://${index}`),
    title: String(item.title ?? `Untitled ${index + 1}`),
    status: Number(item.status ?? 200),
    body: item.body ? String(item.body) : undefined
  }));
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
