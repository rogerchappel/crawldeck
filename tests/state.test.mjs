import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProfile, enqueueJob, loadState, nextQueuedJob } from '../dist/index.js';

test('profiles and jobs persist to a local queue file', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-state-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'sample', fixturePath }, cwd);
  const job = await enqueueJob(profile.id, cwd);
  const state = await loadState(cwd);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].id, job.id);
});

test('next queued job returns the first queued item', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-next-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'sample', fixturePath }, cwd);
  const job = await enqueueJob(profile.id, cwd);
  const next = await nextQueuedJob(cwd);
  assert.equal(next.id, job.id);
});
