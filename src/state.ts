import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureDeckDir, resolveStatePath } from './paths.js';
import type { DeckState } from './types.js';

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
    const parsed = JSON.parse(raw) as DeckState;
    return {
      version: 1,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
    };
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
