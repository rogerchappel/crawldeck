import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProfile, enqueueJob, startJob } from '../dist/index.js';

test('healthy fixture completes without item errors', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-healthy-'));
  const fixturePath = path.resolve('fixtures/healthy-site');
  const profile = await createProfile({ name: 'healthy', fixturePath }, cwd);
  const queued = await enqueueJob(profile.id, cwd);
  const job = await startJob(queued.id, cwd);
  assert.equal(job.status, 'completed');
  assert.equal(job.errors.length, 0);
  assert.equal(job.processedItems, 2);
});
