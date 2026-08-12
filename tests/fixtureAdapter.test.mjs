import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProfile, enqueueJob, fixtureAdapter, startJob, loadState } from '../dist/index.js';

async function profileForItems(items, manifest = JSON.stringify({ items })) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-fixture-status-'));
  const fixturePath = path.join(cwd, 'fixture');
  await mkdir(fixturePath);
  await writeFile(path.join(fixturePath, 'manifest.json'), manifest);
  const profile = await createProfile({ name: 'fixture', fixturePath }, cwd);
  return { cwd, profile };
}

test('fixture adapter inspects and runs local crawl items', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-run-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'fixture', fixturePath }, cwd);
  const queued = await enqueueJob(profile.id, cwd);
  const job = await startJob(queued.id, cwd);
  assert.equal(job.status, 'failed');
  assert.equal(job.totalItems, 3);
  assert.equal(job.processedItems, 3);
  assert.equal(job.errors.length, 1);
  const state = await loadState(cwd);
  assert.equal(state.jobs[0].lastEvent, 'failed: 1 errors');
});

test('fixture adapter accepts boundary HTTP statuses', async () => {
  const { profile } = await profileForItems([{ status: 100 }, { status: 599 }]);
  const items = await fixtureAdapter.inspect(profile);
  assert.deepEqual(items.map((item) => item.status), [100, 599]);
});

for (const [label, status, manifest] of [
  ['string', '200'],
  ['non-finite', undefined, '{"items":[{"url":"https://example.test/bad","status":1e400}]}'],
  ['fraction', 200.5],
  ['below range', 99],
  ['above range', 600]
]) {
  test(`fixture adapter rejects ${label} status during inspect and job start`, async () => {
    const { cwd, profile } = await profileForItems([{ url: 'https://example.test/bad', status }], manifest);
    const expected = /Fixture manifest item 1 has invalid status; expected an integer from 100 to 599:/;

    await assert.rejects(() => fixtureAdapter.inspect(profile), expected);

    const queued = await enqueueJob(profile.id, cwd);
    const failed = await startJob(queued.id, cwd);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.totalItems, 0);
    assert.equal(failed.processedItems, 0);
    assert.match(failed.errors[0], expected);
    assert.equal(failed.lastEvent, `failed: ${failed.errors[0]}`);

    const state = await loadState(cwd);
    assert.deepEqual(state.jobs[0], failed);
  });
}
