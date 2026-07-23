import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createProfile, enqueueJob, loadState, saveState, setJobStatus } from '../dist/index.js';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve('dist/cli.js');

async function createQueuedJob() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-cli-transition-'));
  const profile = await createProfile({
    name: 'healthy',
    fixturePath: path.resolve('fixtures/healthy-site')
  }, cwd);
  const job = await enqueueJob(profile.id, cwd);
  return { cwd, job };
}

async function runJobCommand(cwd, command, jobId) {
  return execFileAsync(process.execPath, [cliPath, 'job', command, jobId], { cwd });
}

const allowedCommands = [
  ['pause', 'queued', 'paused'],
  ['resume', 'paused', 'queued'],
  ['complete', 'queued', 'completed'],
  ['start', 'queued', 'completed']
];

for (const [command, initialStatus, expectedStatus] of allowedCommands) {
  test(`job ${command} allows ${initialStatus} -> ${expectedStatus}`, async () => {
    const { cwd, job } = await createQueuedJob();
    if (initialStatus === 'paused') await setJobStatus(job.id, 'paused', cwd);

    const { stderr } = await runJobCommand(cwd, command, job.id);
    const persisted = (await loadState(cwd)).jobs[0];

    assert.equal(stderr, '');
    assert.equal(persisted.status, expectedStatus);
  });
}

for (const terminalStatus of ['completed', 'failed']) {
  for (const command of ['start', 'pause', 'resume', 'complete']) {
    test(`job ${command} rejects terminal ${terminalStatus} without mutation`, async () => {
      const { cwd, job } = await createQueuedJob();
      const state = await loadState(cwd);
      state.jobs[0] = {
        ...state.jobs[0],
        status: terminalStatus,
        startedAt: '2026-01-01T00:00:30.000Z',
        completedAt: '2026-01-01T00:01:00.000Z',
        updatedAt: '2026-01-01T00:01:00.000Z',
        lastEvent: terminalStatus
      };
      await saveState(state, cwd);
      const before = await loadState(cwd);

      await assert.rejects(
        runJobCommand(cwd, command, job.id),
        (error) => {
          assert.notEqual(error.code, 0);
          assert.match(error.stderr, new RegExp(`crawldeck: Job ${job.id} cannot (?:start|transition) from ${terminalStatus}`));
          return true;
        }
      );

      assert.deepEqual(await loadState(cwd), before);
    });
  }
}
