import path from 'node:path';
import { mkdir } from 'node:fs/promises';

export const DEFAULT_STATE_DIR = '.crawldeck';
export const STATE_FILE = 'queue.json';

export function resolveDeckDir(cwd = process.cwd(), override?: string): string {
  return path.resolve(cwd, override ?? DEFAULT_STATE_DIR);
}

export function resolveStatePath(cwd = process.cwd(), override?: string): string {
  return path.join(resolveDeckDir(cwd, override), STATE_FILE);
}

export async function ensureDeckDir(cwd = process.cwd(), override?: string): Promise<string> {
  const dir = resolveDeckDir(cwd, override);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function toRelative(cwd: string, value: string): string {
  const resolved = path.resolve(cwd, value);
  const rel = path.relative(cwd, resolved);
  return rel.startsWith('..') ? resolved : rel || '.';
}
