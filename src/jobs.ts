import path from 'node:path';
import { getAdapter } from './adapters.js';
import { nextId, timestamp } from './id.js';
import { findProfile } from './profiles.js';
import { loadState, mutateState } from './state.js';
import type { CrawlJob, CrawlJobStatus } from './types.js';

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
    job.status = status;
    job.updatedAt = now;
    if (status === 'running') job.startedAt ??= now;
    if (status === 'completed' || status === 'failed') job.completedAt = now;
    job.lastEvent = status;
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
  await setJobStatus(jobId, 'running', cwd, deckDir);
  const adapter = getAdapter(profile.adapter);
  try {
    const result = await adapter.run(profile, job);
    const now = timestamp();
    const { result: completed } = await mutateState((freshState) => {
      const fresh = freshState.jobs.find((item) => item.id === jobId);
      if (!fresh) throw new Error(`Job not found after run: ${jobId}`);
      fresh.status = result.errors.length > 0 ? 'failed' : 'completed';
      fresh.updatedAt = now;
      fresh.completedAt = now;
      fresh.totalItems = result.totalItems;
      fresh.processedItems = result.processedItems;
      fresh.errors = result.errors;
      fresh.lastEvent = result.errors.length > 0 ? `failed: ${result.errors.length} errors` : `completed: ${result.reportPath}`;
      return fresh;
    }, cwd, deckDir);
    return completed;
  } catch (error) {
    const failed = await setJobStatus(jobId, 'failed', cwd, deckDir);
    failed.errors.push((error as Error).message);
    return failed;
  }
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
