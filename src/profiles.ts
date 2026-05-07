import path from 'node:path';
import { nextId, timestamp } from './id.js';
import { mutateState } from './state.js';
import type { CrawlProfile } from './types.js';

export interface CreateProfileInput {
  name: string;
  fixturePath: string;
  outputDir?: string;
  adapter?: string;
  notes?: string;
}

export async function createProfile(input: CreateProfileInput, cwd = process.cwd(), deckDir?: string): Promise<CrawlProfile> {
  const now = timestamp();
  const { result } = await mutateState((state) => {
    const id = nextId(input.name, state.profiles);
    const profile: CrawlProfile = {
      id,
      name: input.name,
      adapter: input.adapter ?? 'fixture',
      fixturePath: path.resolve(cwd, input.fixturePath),
      outputDir: path.resolve(cwd, input.outputDir ?? '.crawldeck/out'),
      createdAt: now,
      updatedAt: now,
      notes: input.notes
    };
    state.profiles.push(profile);
    return profile;
  }, cwd, deckDir);
  return result;
}

export function findProfile(profiles: CrawlProfile[], profileIdOrName: string): CrawlProfile {
  const profile = profiles.find((item) => item.id === profileIdOrName || item.name === profileIdOrName);
  if (!profile) throw new Error(`Profile not found: ${profileIdOrName}`);
  return profile;
}
