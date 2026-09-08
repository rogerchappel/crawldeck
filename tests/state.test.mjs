import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { acquireStateLock, createProfile, enqueueJob, loadState, nextQueuedJob } from '../dist/index.js';

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

async function writeState(cwd, value) {
  const deckDir = path.join(cwd, '.crawldeck');
  await mkdir(deckDir, { recursive: true });
  const statePath = path.join(deckDir, 'queue.json');
  const raw = JSON.stringify(value);
  await writeFile(statePath, raw);
  return { statePath, raw };
}

test('loads a complete valid persisted state', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-valid-state-'));
  const value = {
    version: 1,
    profiles: [{
      id: 'docs', name: 'Docs', adapter: 'fixture', fixturePath: '/tmp/fixtures',
      outputDir: '/tmp/out', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', notes: 'local'
    }],
    jobs: [{
      id: 'docs-job-1', profileId: 'docs', status: 'failed', createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:01:00Z', startedAt: '2026-01-01T00:00:10Z',
      completedAt: '2026-01-01T00:01:00Z', totalItems: 2, processedItems: 1,
      errors: ['404 https://example.test/missing'], outputDir: '/tmp/out/docs-job-1', lastEvent: 'failed'
    }]
  };
  await writeState(cwd, value);
  assert.deepEqual(await loadState(cwd), value);
});

test('rejects malformed persisted state with stable field diagnostics and preserves the file', async () => {
  const cases = [
    [null, 'root must be an object'],
    [{ version: 2, profiles: [], jobs: [] }, 'version must be 1'],
    [{ version: 1, profiles: null, jobs: [] }, 'profiles must be an array'],
    [{ version: 1, profiles: [null], jobs: [] }, 'profiles[0] must be an object'],
    [{ version: 1, profiles: [{ id: 3 }], jobs: [] }, 'profiles[0].id must be a string'],
    [{ version: 1, profiles: [], jobs: null }, 'jobs must be an array'],
    [{ version: 1, profiles: [], jobs: [null] }, 'jobs[0] must be an object'],
    [{ version: 1, profiles: [], jobs: [{ id: 'j', profileId: 'p', status: 'waiting' }] }, 'jobs[0].status must be one of queued, running, paused, completed, failed'],
    [{ version: 1, profiles: [], jobs: [{ id: 'j', profileId: 'p', status: 'queued', createdAt: 'now', updatedAt: 'now', totalItems: -1, processedItems: 0, errors: [], outputDir: 'out' }] }, 'jobs[0].totalItems must be a non-negative integer'],
    [{ version: 1, profiles: [], jobs: [{ id: 'j', profileId: 'p', status: 'queued', createdAt: 'now', updatedAt: 'now', totalItems: 1, processedItems: 0, errors: [4], outputDir: 'out' }] }, 'jobs[0].errors[0] must be a string'],
    [{ version: 1, profiles: [], jobs: [{ id: 'j', profileId: 'p', status: 'queued', createdAt: 'now', updatedAt: 'now', totalItems: 1, processedItems: 0, errors: [], outputDir: 'out', lastEvent: 4 }] }, 'jobs[0].lastEvent must be a string when provided']
  ];

  for (const [index, [value, diagnostic]] of cases.entries()) {
    const cwd = await mkdtemp(path.join(tmpdir(), `crawldeck-invalid-state-${index}-`));
    const { statePath, raw } = await writeState(cwd, value);
    await assert.rejects(loadState(cwd), (error) => {
      assert.equal(error.message, `Invalid queue state ${statePath}: ${diagnostic}`);
      return true;
    });
    assert.equal(await readFile(statePath, 'utf8'), raw);
  }
});

test('CLI reports malformed state without incidental JavaScript diagnostics', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-invalid-state-cli-'));
  const { statePath, raw } = await writeState(cwd, { version: 1, profiles: [null], jobs: [] });
  const cliPath = path.resolve('dist/cli.js');
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, 'profile', 'list'], { cwd }),
    (error) => {
      assert.match(error.stderr, new RegExp(`Invalid queue state .*queue\\.json: profiles\\[0\\] must be an object`));
      assert.doesNotMatch(error.stderr, /TypeError|Cannot read properties/);
      return true;
    }
  );
  assert.equal(await readFile(statePath, 'utf8'), raw);
});

async function runParallelEnqueue() {
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
  return { emittedIds, persistedIds };
}

test('parallel CLI processes repeatedly enqueue without errors, duplicate IDs, or lost jobs', async () => {
  for (let run = 0; run < 5; run += 1) {
    const { emittedIds, persistedIds } = await runParallelEnqueue();
    assert.equal(new Set(emittedIds).size, 20);
    assert.equal(new Set(persistedIds).size, 20);
  }
});

test('lock release preserves a replacement owner after an ABA path change', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-lock-aba-'));
  const lockPath = path.join(cwd, '.crawldeck', 'queue.json.lock');
  const release = await acquireStateLock(cwd);

  await rm(lockPath, { recursive: true });
  await mkdir(lockPath);
  const replacement = { pid: process.pid, token: 'replacement-owner' };
  await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify(replacement));

  await release();
  assert.deepEqual(JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8')), replacement);
});

test('lock acquisition retries owner metadata removal races', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-lock-owner-race-'));
  const lockPath = path.join(cwd, '.crawldeck', 'queue.json.lock');
  await mkdir(lockPath, { recursive: true });

  const acquisition = acquireStateLock(cwd);
  await new Promise((resolve) => setTimeout(resolve, 25));
  await rm(lockPath, { recursive: true });
  const release = await acquisition;
  await release();
});

test('lock acquisition recovers a stale owner and removes only that owner', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-lock-stale-'));
  const lockPath = path.join(cwd, '.crawldeck', 'queue.json.lock');
  await mkdir(lockPath, { recursive: true });
  await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: 2_147_483_647, token: 'stale-owner' }));

  const release = await acquireStateLock(cwd);
  const owner = JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8'));
  assert.notEqual(owner.token, 'stale-owner');
  await release();
});
