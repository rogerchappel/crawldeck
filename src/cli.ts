#!/usr/bin/env node
import { inspect } from 'node:util';
import { getAdapter, listAdapters } from './adapters.js';
import { startJob, completeJob, enqueueJob, getJob, nextQueuedJob, setJobStatus } from './jobs.js';
import { createProfile, findProfile } from './profiles.js';
import { renderHealth, renderJobs, renderProfiles, renderReport } from './reports.js';
import { ensureDeckDir } from './paths.js';
import { loadState, saveState } from './state.js';

function help(): string {
  return `crawldeck - local-first crawl queue control plane

Usage:
  crawldeck init
  crawldeck adapters
  crawldeck profile add <name> --fixture <path> [--out <dir>]
  crawldeck profile list
  crawldeck inspect <profile>
  crawldeck job enqueue <profile>
  crawldeck job list
  crawldeck job next
  crawldeck job status <job-id>
  crawldeck job start <job-id>
  crawldeck job pause <job-id>
  crawldeck job resume <job-id>
  crawldeck job complete <job-id>
  crawldeck health
  crawldeck report [--json]

Global options --deck-dir <dir> and --json may appear before or after a command.
All state lives in ./.crawldeck/queue.json unless --deck-dir <dir> is supplied.`;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function withoutGlobalOptions(args: string[]): { args: string[]; deckDir?: string; json: boolean } {
  const remaining: string[] = [];
  let deckDir: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--deck-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--deck-dir requires a directory value');
      deckDir = value;
      index += 1;
      continue;
    }
    remaining.push(arg);
  }

  return { args: remaining, deckDir, json };
}

function validateArguments(args: string[]): void {
  const command = args[0];
  const exact = (usage: string, count: number): void => {
    if (args.length === count) return;
    const unexpected = args.slice(count);
    if (unexpected.length > 0) throw new Error(`${usage} does not accept: ${unexpected.join(' ')}`);
    throw new Error(`${usage} requires ${usage.includes('<') ? usage.slice(usage.indexOf('<')) : 'more arguments'}`);
  };

  if (!command || command === '--help' || command === '-h' || command === '--version' || command === '-v') {
    exact(command ?? 'crawldeck', command ? 1 : 0);
  } else if (['init', 'adapters', 'health', 'report'].includes(command)) {
    exact(command, 1);
  } else if (command === 'inspect') {
    exact('inspect <profile>', 2);
  } else if (command === 'profile' && args[1] === 'list') {
    exact('profile list', 2);
  } else if (command === 'profile' && args[1] === 'add') {
    validateProfileAdd(args);
  } else if (command === 'job' && ['list', 'next'].includes(args[1] ?? '')) {
    exact(`job ${args[1]}`, 2);
  } else if (command === 'job' && ['enqueue', 'status', 'start', 'pause', 'resume', 'complete'].includes(args[1] ?? '')) {
    exact(`job ${args[1]} <${args[1] === 'enqueue' ? 'profile' : 'job-id'}>`, 3);
  }
}

function validateProfileAdd(args: string[]): void {
  if (!args[2] || args[2].startsWith('--')) throw new Error('profile add requires <name>');
  const seen = new Set<string>();
  for (let index = 3; index < args.length; index += 2) {
    const flag = args[index];
    if (flag !== '--fixture' && flag !== '--out') throw new Error(`profile add does not accept: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    if (seen.has(flag)) throw new Error(`profile add does not accept duplicate ${flag}`);
    seen.add(flag);
  }
  if (!seen.has('--fixture')) throw new Error('profile add requires --fixture <path>');
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = withoutGlobalOptions(argv);
  const args = parsed.args;
  const command = args[0];
  validateArguments(args);

  if (!command || command === '--help' || command === '-h') {
    console.log(help());
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log('0.1.0');
    return;
  }

  if (command === 'init') {
    const dir = await ensureDeckDir(process.cwd(), parsed.deckDir);
    const state = await loadState(process.cwd(), parsed.deckDir);
    await saveState(state, process.cwd(), parsed.deckDir);
    console.log(`Initialized crawldeck at ${dir}`);
    return;
  }

  if (command === 'adapters') {
    console.log(listAdapters().join('\n'));
    return;
  }

  if (command === 'profile' && args[1] === 'add') {
    const name = args[2];
    const fixturePath = option(args, '--fixture');
    const outputDir = option(args, '--out');
    if (!name || !fixturePath) throw new Error('profile add requires <name> and --fixture <path>');
    const profile = await createProfile({ name, fixturePath, outputDir }, process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(profile, null, 2) : `Created profile ${profile.id}`);
    return;
  }

  if (command === 'profile' && args[1] === 'list') {
    const state = await loadState(process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(state.profiles, null, 2) : renderProfiles(state));
    return;
  }

  if (command === 'inspect') {
    const target = args[1];
    if (!target) throw new Error('inspect requires a profile id or name');
    const state = await loadState(process.cwd(), parsed.deckDir);
    const profile = findProfile(state.profiles, target);
    const items = await getAdapter(profile.adapter).inspect(profile);
    console.log(parsed.json ? JSON.stringify(items, null, 2) : items.map((item) => `${item.status}\t${item.title}\t${item.url}`).join('\n'));
    return;
  }

  if (command === 'job' && args[1] === 'enqueue') {
    const profile = args[2];
    if (!profile) throw new Error('job enqueue requires a profile id or name');
    const job = await enqueueJob(profile, process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `Queued job ${job.id}`);
    return;
  }

  if (command === 'job' && args[1] === 'list') {
    const state = await loadState(process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(state.jobs, null, 2) : renderJobs(state));
    return;
  }

  if (command === 'job' && args[1] === 'next') {
    const job = await nextQueuedJob(process.cwd(), parsed.deckDir);
    console.log(job ? (parsed.json ? JSON.stringify(job, null, 2) : `${job.id} ${job.profileId} ${job.status}`) : 'No queued jobs');
    return;
  }

  if (command === 'job' && args[1] === 'status') {
    const job = await getJob(required(args[2], 'job status requires <job-id>'), process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `${job.id} ${job.status} ${job.processedItems}/${job.totalItems} ${job.lastEvent ?? ''}`);
    return;
  }

  if (command === 'job' && args[1] === 'start') {
    const job = await startJob(required(args[2], 'job start requires <job-id>'), process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `${job.id} ${job.status} ${job.processedItems}/${job.totalItems}`);
    return;
  }

  if (command === 'job' && args[1] === 'pause') {
    const job = await setJobStatus(required(args[2], 'job pause requires <job-id>'), 'paused', process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `${job.id} paused`);
    return;
  }

  if (command === 'job' && args[1] === 'resume') {
    const job = await setJobStatus(required(args[2], 'job resume requires <job-id>'), 'queued', process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `${job.id} queued`);
    return;
  }

  if (command === 'job' && args[1] === 'complete') {
    const job = await completeJob(required(args[2], 'job complete requires <job-id>'), process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(job, null, 2) : `${job.id} completed`);
    return;
  }

  if (command === 'health') {
    const state = await loadState(process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(state, null, 2) : renderHealth(state));
    return;
  }

  if (command === 'report') {
    const state = await loadState(process.cwd(), parsed.deckDir);
    console.log(parsed.json ? JSON.stringify(state, null, 2) : renderReport(state));
    return;
  }

  throw new Error(`Unknown command: ${inspect(args)}`);
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

main().catch((error: unknown) => {
  console.error(`crawldeck: ${(error as Error).message}`);
  process.exitCode = 1;
});
