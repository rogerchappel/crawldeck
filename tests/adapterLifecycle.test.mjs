import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { adapterSeam, createProfile, enqueueJob, loadState, setJobStatus, startJob } from '../dist/index.js';

const observations = [];
let nextErrors = [];

adapterSeam('lifecycle-probe', () => ({
  name: 'lifecycle-probe',
  async inspect() { return []; },
  async run(_profile, job) {
    observations.push(structuredClone(job));
    return {
      totalItems: 3,
      processedItems: nextErrors.length === 0 ? 3 : 2,
      errors: nextErrors,
      reportPath: 'out/report.json'
    };
  }
}));

async function setup() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-adapter-lifecycle-'));
  const profile = await createProfile({
    name: 'lifecycle',
    adapter: 'lifecycle-probe',
    fixturePath: '.',
    outputDir: 'out'
  }, cwd);
  return { cwd, queued: await enqueueJob(profile.id, cwd) };
}

test('adapter receives the persisted running snapshot and successful results are persisted', async () => {
  observations.length = 0;
  nextErrors = [];
  const { cwd, queued } = await setup();

  const completed = await startJob(queued.id, cwd);

  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0], {
    ...queued,
    status: 'running',
    updatedAt: observations[0].updatedAt,
    startedAt: observations[0].startedAt,
    lastEvent: 'running'
  });
  assert.equal(observations[0].updatedAt, observations[0].startedAt);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.totalItems, 3);
  assert.equal(completed.processedItems, 3);
  assert.deepEqual(completed.errors, []);

  const state = await loadState(cwd);
  assert.deepEqual(state.jobs[0], completed);
});

test('adapter receives running rather than paused and error results are persisted', async () => {
  observations.length = 0;
  nextErrors = ['crawl failed'];
  const { cwd, queued } = await setup();
  const paused = await setJobStatus(queued.id, 'paused', cwd);

  const failed = await startJob(paused.id, cwd);

  assert.equal(observations.length, 1);
  assert.equal(observations[0].status, 'running');
  assert.equal(observations[0].lastEvent, 'running');
  assert.equal(observations[0].startedAt, observations[0].updatedAt);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.totalItems, 3);
  assert.equal(failed.processedItems, 2);
  assert.deepEqual(failed.errors, ['crawl failed']);
  assert.equal(failed.lastEvent, 'failed: 1 errors');

  const state = await loadState(cwd);
  assert.deepEqual(state.jobs[0], failed);
});
