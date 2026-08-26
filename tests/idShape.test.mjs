import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProfile, enqueueJob } from '../dist/index.js';

// The ids documented in examples/local-session.md: profile `local-docs` gets id
// `local-docs-001` and its first job is `local-docs-001-job-001`, i.e. the
// `<profile>-NNN-job-NNN` shape. These tests lock that contract so the example
// cannot silently drift from the generated ids again.
const PROFILE_ID_SHAPE = /^local-docs-\d{3}$/;
const JOB_ID_SHAPE = /^local-docs-\d{3}-job-\d{3}$/;

test('generated profile and job ids match the documented example shape', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-id-shape-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'local-docs', fixturePath }, cwd);
  assert.match(profile.id, PROFILE_ID_SHAPE, 'profile id must match documented <profile>-NNN shape');

  const job = await enqueueJob(profile.id, cwd);
  assert.match(job.id, JOB_ID_SHAPE, 'job id must match documented <profile>-NNN-job-NNN shape');
  assert.equal(job.id, `${profile.id}-job-001`);
});

test('sequential job ids keep the documented shape while incrementing', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'crawldeck-id-shape-'));
  const fixturePath = path.resolve('fixtures/sample-site');
  const profile = await createProfile({ name: 'local-docs', fixturePath }, cwd);
  const first = await enqueueJob(profile.id, cwd);
  const second = await enqueueJob(profile.id, cwd);
  assert.match(first.id, JOB_ID_SHAPE);
  assert.match(second.id, JOB_ID_SHAPE);
  assert.equal(second.id, `${profile.id}-job-002`);
});