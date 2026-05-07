import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProfile, enqueueJob, startJob, loadState } from '../dist/index.js';

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
