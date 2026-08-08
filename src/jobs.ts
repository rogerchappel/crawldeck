import path from 'node:path';
import { getAdapter } from './adapters.js';
import { nextId, timestamp } from './id.js';
import { findProfile } from './profiles.js';
import { loadState, mutateState } from './state.js';
import type { CrawlJob, CrawlJobStatus, CrawlRunResult } from './types.js';

const JOB_STATUS_TRANSITIONS: Readonly<Record<CrawlJobStatus, readonly CrawlJobStatus[]>> = {
  queued: ['running', 'paused', 'completed'],
  running: ['paused', 'completed', 'failed'],
  paused: ['queued', 'running', 'completed'],
  completed: [],
  failed: []
};

function applyJobStatus(job: CrawlJob, status: CrawlJobStatus, now: string, lastEvent: string = status): void {
  if (!JOB_STATUS_TRANSITIONS[job.status].includes(status)) {
    throw new Error(`Job ${job.id} cannot transition from ${job.status} to ${status}`);
  }
  job.status = status;
  job.updatedAt = now;
  if (status === 'running') job.startedAt ??= now;
  if (status === 'completed' || status === 'failed') job.completedAt = now;
  job.lastEvent = lastEvent;
}

export async function enqueueJob(profileIdOrName: string, cwd = process.cwd(), deckDir?: string): Promise<CrawlJob> {
  const now = timestamp();
  const { result } = await mutateState((state) => {
    const profile = findProfile(state.profiles, profileIdOrName);
    const id = nextId(`${profile.id}-job`, state.jobs);
    const job: CrawlJob = {
      id,
      profileId: profile.id,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      totalItems: 0,
      processedItems: 0,
      errors: [],
      outputDir: path.join(profile.outputDir, id),
      lastEvent: 'queued'
    };
    state.jobs.push(job);
    return job;
  }, cwd, deckDir);
  return result;
}

export async function setJobStatus(jobId: string, status: CrawlJobStatus, cwd = process.cwd(), deckDir?: string): Promise<CrawlJob> {
  const now = timestamp();
  const { result } = await mutateState((state) => {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    applyJobStatus(job, status, now);
    return job;
  }, cwd, deckDir);
  return result;
}

export async function startJob(jobId: string, cwd = process.cwd(), deckDir?: string): Promise<CrawlJob> {
  const state = await loadState(cwd, deckDir);
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.status !== 'queued' && job.status !== 'paused') throw new Error(`Job ${job.id} cannot start from ${job.status}`);
  const profile = findProfile(state.profiles, job.profileId);
  const running = await setJobStatus(jobId, 'running', cwd, deckDir);
  const adapter = getAdapter(profile.adapter);
  let adapterResult: CrawlRunResult;
  try {
    adapterResult = await adapter.run(profile, running);
  } catch (error) {
    const message = (error as Error).message;
    const now = timestamp();
    const { result: failed } = await mutateState((freshState) => {
      const fresh = freshState.jobs.find((item) => item.id === jobId);
      if (!fresh) throw new Error(`Job not found after adapter failure: ${jobId}`);
      applyJobStatus(fresh, 'failed', now, `failed: ${message}`);
      fresh.errors = [...fresh.errors, message];
      return fresh;
    }, cwd, deckDir);
    return failed;
  }

  const now = timestamp();
  const { result: completed } = await mutateState((freshState) => {
    const fresh = freshState.jobs.find((item) => item.id === jobId);
    if (!fresh) throw new Error(`Job not found after run: ${jobId}`);
    const status = adapterResult.errors.length > 0 ? 'failed' : 'completed';
    const lastEvent = adapterResult.errors.length > 0
      ? `failed: ${adapterResult.errors.length} errors`
      : `completed: ${adapterResult.reportPath}`;
    applyJobStatus(fresh, status, now, lastEvent);
    fresh.totalItems = adapterResult.totalItems;
    fresh.processedItems = adapterResult.processedItems;
    fresh.errors = adapterResult.errors;
    return fresh;
  }, cwd, deckDir);
  return completed;
}

export async function completeJob(jobId: string, cwd = process.cwd(), deckDir?: string): Promise<CrawlJob> {
  return setJobStatus(jobId, 'completed', cwd, deckDir);
}

export async function nextQueuedJob(cwd = process.cwd(), deckDir?: string): Promise<CrawlJob | undefined> {
  const state = await loadState(cwd, deckDir);
  return state.jobs.find((job) => job.status === 'queued');
}

export async function getJob(jobId: string, cwd = process.cwd(), deckDir?: string): Promise<CrawlJob> {
  const state = await loadState(cwd, deckDir);
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  return job;
}
