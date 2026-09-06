import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureDeckDir, resolveStatePath } from './paths.js';
import type { CrawlJob, CrawlJobStatus, CrawlProfile, DeckState } from './types.js';

const JOB_STATUSES: CrawlJobStatus[] = ['queued', 'running', 'paused', 'completed', 'failed'];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, field: string, context: string): string {
  if (typeof value[field] !== 'string') throw new Error(`${context}.${field} must be a string`);
  return value[field];
}

function optionalStringField(value: Record<string, unknown>, field: string, context: string): string | undefined {
  if (value[field] === undefined) return undefined;
  if (typeof value[field] !== 'string') throw new Error(`${context}.${field} must be a string when provided`);
  return value[field];
}

function profile(value: unknown, index: number): CrawlProfile {
  const context = `profiles[${index}]`;
  if (!isObject(value)) throw new Error(`${context} must be an object`);
  return {
    id: stringField(value, 'id', context),
    name: stringField(value, 'name', context),
    adapter: stringField(value, 'adapter', context),
    fixturePath: stringField(value, 'fixturePath', context),
    outputDir: stringField(value, 'outputDir', context),
    createdAt: stringField(value, 'createdAt', context),
    updatedAt: stringField(value, 'updatedAt', context),
    ...(value.notes === undefined ? {} : { notes: optionalStringField(value, 'notes', context) })
  };
}

function nonNegativeInteger(value: Record<string, unknown>, field: string, context: string): number {
  const result = value[field];
  if (!Number.isInteger(result) || (result as number) < 0) {
    throw new Error(`${context}.${field} must be a non-negative integer`);
  }
  return result as number;
}

function job(value: unknown, index: number): CrawlJob {
  const context = `jobs[${index}]`;
  if (!isObject(value)) throw new Error(`${context} must be an object`);
  if (typeof value.status !== 'string' || !JOB_STATUSES.includes(value.status as CrawlJobStatus)) {
    throw new Error(`${context}.status must be one of ${JOB_STATUSES.join(', ')}`);
  }
  if (!Array.isArray(value.errors)) throw new Error(`${context}.errors must be an array`);
  const errors = value.errors.map((entry, errorIndex) => {
    if (typeof entry !== 'string') throw new Error(`${context}.errors[${errorIndex}] must be a string`);
    return entry;
  });
  return {
    id: stringField(value, 'id', context),
    profileId: stringField(value, 'profileId', context),
    status: value.status as CrawlJobStatus,
    createdAt: stringField(value, 'createdAt', context),
    updatedAt: stringField(value, 'updatedAt', context),
    ...(value.startedAt === undefined ? {} : { startedAt: optionalStringField(value, 'startedAt', context) }),
    ...(value.completedAt === undefined ? {} : { completedAt: optionalStringField(value, 'completedAt', context) }),
    totalItems: nonNegativeInteger(value, 'totalItems', context),
    processedItems: nonNegativeInteger(value, 'processedItems', context),
    errors,
    outputDir: stringField(value, 'outputDir', context),
    ...(value.lastEvent === undefined ? {} : { lastEvent: optionalStringField(value, 'lastEvent', context) })
  };
}

function validateState(value: unknown): DeckState {
  if (!isObject(value)) throw new Error('root must be an object');
  if (value.version !== 1) throw new Error('version must be 1');
  if (!Array.isArray(value.profiles)) throw new Error('profiles must be an array');
  if (!Array.isArray(value.jobs)) throw new Error('jobs must be an array');
  return { version: 1, profiles: value.profiles.map(profile), jobs: value.jobs.map(job) };
}

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 15_000;

async function acquireStateLock(cwd: string, deckDir?: string): Promise<() => Promise<void>> {
  await ensureDeckDir(cwd, deckDir);
  const lockPath = `${resolveStatePath(cwd, deckDir)}.lock`;
  const startedAt = Date.now();

  while (true) {
    try {
      await mkdir(lockPath);
      try {
        await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid }), 'utf8');
      } catch (error) {
        await rm(lockPath, { recursive: true, force: true });
        throw error;
      }
      return async () => {
        await rm(lockPath, { recursive: true, force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      try {
        const owner = JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8')) as { pid?: number };
        if (typeof owner.pid === 'number') {
          try {
            process.kill(owner.pid, 0);
          } catch (ownerError) {
            if ((ownerError as NodeJS.ErrnoException).code === 'ESRCH') {
              const stalePath = `${lockPath}.stale-${process.pid}-${randomUUID()}`;
              try {
                await rename(lockPath, stalePath);
              } catch (renameError) {
                if ((renameError as NodeJS.ErrnoException).code === 'ENOENT') continue;
                throw renameError;
              }
              await rm(stalePath, { recursive: true, force: true });
              continue;
            }
          }
        }
      } catch (ownerError) {
        if (ownerError instanceof SyntaxError || (ownerError as NodeJS.ErrnoException).code === 'ENOENT') {
          // The lock owner may still be writing its metadata; retry normally.
        } else {
          throw ownerError;
        }
      }

      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for state lock: ${lockPath}`);
      }
      await delay(LOCK_RETRY_MS);
    }
  }
}

export function emptyState(): DeckState {
  return { version: 1, profiles: [], jobs: [] };
}

export async function loadState(cwd = process.cwd(), deckDir?: string): Promise<DeckState> {
  const statePath = resolveStatePath(cwd, deckDir);
  try {
    const raw = await readFile(statePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid queue state ${statePath}: cannot parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      return validateState(parsed);
    } catch (error) {
      throw new Error(`Invalid queue state ${statePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    throw error;
  }
}

export async function saveState(state: DeckState, cwd = process.cwd(), deckDir?: string): Promise<string> {
  const dir = await ensureDeckDir(cwd, deckDir);
  const statePath = resolveStatePath(cwd, deckDir);
  const tempPath = path.join(dir, `${process.pid}-${randomUUID()}.queue.json.tmp`);
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(tempPath, statePath);
  return statePath;
}

export async function mutateState<T>(
  mutator: (state: DeckState) => T | Promise<T>,
  cwd = process.cwd(),
  deckDir?: string
): Promise<{ state: DeckState; result: T; statePath: string }> {
  const releaseLock = await acquireStateLock(cwd, deckDir);
  try {
    const state = await loadState(cwd, deckDir);
    const result = await mutator(state);
    const statePath = await saveState(state, cwd, deckDir);
    return { state, result, statePath };
  } finally {
    await releaseLock();
  }
}
