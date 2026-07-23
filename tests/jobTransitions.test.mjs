import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadState, saveState, setJobStatus } from '../dist/index.js';

const allowedTransitions = [
  ['queued', 'running'],
  ['queued', 'paused'],
  ['queued', 'completed'],
  ['running', 'paused'],
  ['running', 'completed'],
  ['running', 'failed'],
  ['paused', 'queued'],
  ['paused', 'running'],
  ['paused', 'completed']
];

const rejectedTransitions = [
  ['queued', 'queued'],
  ['queued', 'failed'],
  ['running', 'queued'],
  ['running', 'running'],
  ['paused', 'paused'],
  ['paused', 'failed'],
  ['completed', 'queued'],
  ['completed', 'running'],
  ['completed', 'paused'],
  ['completed', 'completed'],
  ['completed', 'failed'],
  ['failed', 'queued'],
  ['failed', 'running'],
  ['failed', 'paused'],
  ['failed', 'completed'],
  ['failed', 'failed']
];

async function deckWithStatus(status) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-transitions-'));
  const terminal = status === 'completed' || status === 'failed';
  await saveState({
    version: 1,
    profiles: [],
    jobs: [{
      id: 'job-1',
      profileId: 'profile-1',
      status,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
      ...(status === 'queued' ? {} : { startedAt: '2026-01-01T00:00:30.000Z' }),
      ...(terminal ? { completedAt: '2026-01-01T00:01:00.000Z' } : {}),
      totalItems: 0,
      processedItems: 0,
      errors: [],
      outputDir: 'out',
      lastEvent: status
    }]
  }, cwd);
  return cwd;
}

for (const [from, to] of allowedTransitions) {
  test(`allows ${from} -> ${to}`, async () => {
    const cwd = await deckWithStatus(from);
    const job = await setJobStatus('job-1', to, cwd);

    assert.equal(job.status, to);
    assert.equal(job.lastEvent, to);
    assert.notEqual(job.updatedAt, '2026-01-01T00:01:00.000Z');
    if (to === 'running') assert.ok(job.startedAt);
    if (to === 'completed' || to === 'failed') assert.ok(job.completedAt);
  });
}

for (const [from, to] of rejectedTransitions) {
  test(`rejects ${from} -> ${to} without mutating state`, async () => {
    const cwd = await deckWithStatus(from);
    const before = await loadState(cwd);

    await assert.rejects(
      setJobStatus('job-1', to, cwd),
      new RegExp(`Job job-1 cannot transition from ${from} to ${to}`)
    );

    assert.deepEqual(await loadState(cwd), before);
  });
}
