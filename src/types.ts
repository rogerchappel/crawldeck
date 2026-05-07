export type CrawlJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export interface CrawlProfile {
  id: string;
  name: string;
  adapter: string;
  fixturePath: string;
  outputDir: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CrawlJob {
  id: string;
  profileId: string;
  status: CrawlJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  totalItems: number;
  processedItems: number;
  errors: string[];
  outputDir: string;
  lastEvent?: string;
}

export interface DeckState {
  version: 1;
  profiles: CrawlProfile[];
  jobs: CrawlJob[];
}

export interface CrawlItem {
  url: string;
  title: string;
  status: number;
  body?: string;
}

export interface CrawlRunResult {
  totalItems: number;
  processedItems: number;
  errors: string[];
  reportPath: string;
}

export interface CrawlAdapter {
  name: string;
  inspect(profile: CrawlProfile): Promise<CrawlItem[]>;
  run(profile: CrawlProfile, job: CrawlJob): Promise<CrawlRunResult>;
}
