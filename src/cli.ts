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

All state lives in ./.crawldeck/queue.json unless --deck-dir <dir> is supplied.`;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function withoutGlobalOptions(args: string[]): { args: string[]; deckDir?: string; json: boolean } {
  const copy = [...args];
  const deckDir = option(copy, '--deck-dir');
  const deckIndex = copy.indexOf('--deck-dir');
  if (deckIndex >= 0) copy.splice(deckIndex, 2);
  const json = copy.includes('--json');
  return { args: copy.filter((arg) => arg !== '--json'), deckDir, json };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = withoutGlobalOptions(argv);
  const args = parsed.args;
  const command = args[0];

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
    console.log(`${job.id} paused`);
    return;
  }

  if (command === 'job' && args[1] === 'resume') {
    const job = await setJobStatus(required(args[2], 'job resume requires <job-id>'), 'queued', process.cwd(), parsed.deckDir);
    console.log(`${job.id} queued`);
    return;
  }

  if (command === 'job' && args[1] === 'complete') {
    const job = await completeJob(required(args[2], 'job complete requires <job-id>'), process.cwd(), parsed.deckDir);
    console.log(`${job.id} completed`);
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
