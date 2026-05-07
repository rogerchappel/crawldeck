import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { adapterSeam, createProfile, enqueueJob, loadState, startJob } from '../dist/index.js';

adapterSeam('exploding-fixture', () => ({
  name: 'exploding-fixture',
  async inspect() { return []; },
  async run() { throw new Error('adapter boom'); }
}));

test('adapter run exceptions are persisted on the failed job', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-adapter-failure-'));
  const profile = await createProfile({
    name: 'boom',
    adapter: 'exploding-fixture',
    fixturePath: '.',
    outputDir: 'out'
  }, cwd);
  const queued = await enqueueJob(profile.id, cwd);

  const failed = await startJob(queued.id, cwd);
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.errors, ['adapter boom']);
  assert.equal(failed.lastEvent, 'failed: adapter boom');

  const state = await loadState(cwd);
  assert.deepEqual(state.jobs[0].errors, ['adapter boom']);
  assert.equal(state.jobs[0].lastEvent, 'failed: adapter boom');
});
