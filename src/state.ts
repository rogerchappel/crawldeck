import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDeckDir, resolveStatePath } from './paths.js';
import type { DeckState } from './types.js';

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
  const tempPath = path.join(dir, `${Date.now()}.queue.json.tmp`);
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(tempPath, statePath);
  return statePath;
}

export async function mutateState<T>(
  mutator: (state: DeckState) => T | Promise<T>,
  cwd = process.cwd(),
  deckDir?: string
): Promise<{ state: DeckState; result: T; statePath: string }> {
  const state = await loadState(cwd, deckDir);
  const result = await mutator(state);
  const statePath = await saveState(state, cwd, deckDir);
  return { state, result, statePath };
}
