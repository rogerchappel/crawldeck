import type { DeckState } from './types.js';

export function renderHealth(state: DeckState): string {
  const queued = state.jobs.filter((job) => job.status === 'queued').length;
  const running = state.jobs.filter((job) => job.status === 'running').length;
  const paused = state.jobs.filter((job) => job.status === 'paused').length;
  const completed = state.jobs.filter((job) => job.status === 'completed').length;
  const failed = state.jobs.filter((job) => job.status === 'failed').length;
  const lines = [
    'crawldeck health',
    `profiles: ${state.profiles.length}`,
    `jobs: ${state.jobs.length}`,
    `queued: ${queued}`,
    `running: ${running}`,
    `paused: ${paused}`,
    `completed: ${completed}`,
    `failed: ${failed}`
  ];
  return lines.join('\n');
}

export function renderJobs(state: DeckState): string {
  if (state.jobs.length === 0) return 'No jobs yet. Try: crawldeck job enqueue <profile>';
  return state.jobs
    .map((job) => `${job.id}\t${job.profileId}\t${job.status}\t${job.processedItems}/${job.totalItems}\t${job.lastEvent ?? '-'}`)
    .join('\n');
}

export function renderProfiles(state: DeckState): string {
  if (state.profiles.length === 0) return 'No profiles yet. Try: crawldeck profile add demo --fixture fixtures/sample-site';
  return state.profiles.map((profile) => `${profile.id}\t${profile.name}\t${profile.adapter}\t${profile.fixturePath}`).join('\n');
}

export function renderReport(state: DeckState): string {
  const failureCount = state.jobs.reduce((sum, job) => sum + job.errors.length, 0);
  const processed = state.jobs.reduce((sum, job) => sum + job.processedItems, 0);
  return [
    '# crawldeck report',
    '',
    `- profiles: ${state.profiles.length}`,
    `- jobs: ${state.jobs.length}`,
    `- processed items: ${processed}`,
    `- recorded errors: ${failureCount}`,
    '',
    '## Recent jobs',
    '',
    state.jobs.slice(-5).map((job) => `- ${job.id}: ${job.status} (${job.processedItems}/${job.totalItems})`).join('\n') || '- none'
  ].join('\n');
}
