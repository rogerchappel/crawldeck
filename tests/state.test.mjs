import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createProfile, enqueueJob, loadState, nextQueuedJob } from '../dist/index.js';

const execFileAsync = promisify(execFile);

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

test('parallel CLI processes enqueue without errors, duplicate IDs, or lost jobs', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-concurrent-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'sample', fixturePath }, cwd);
  const cliPath = path.resolve('dist/cli.js');
  const processCount = 20;

  const results = await Promise.all(
    Array.from({ length: processCount }, () =>
      execFileAsync(process.execPath, [cliPath, 'job', 'enqueue', profile.id, '--json'], { cwd })
    )
  );
  const emittedIds = results.map(({ stdout, stderr }) => {
    assert.equal(stderr, '');
    return JSON.parse(stdout).id;
  });
  const state = await loadState(cwd);
  const persistedIds = state.jobs.map((job) => job.id);

  assert.equal(new Set(emittedIds).size, processCount);
  assert.equal(state.jobs.length, processCount);
  assert.deepEqual(new Set(persistedIds), new Set(emittedIds));
});
