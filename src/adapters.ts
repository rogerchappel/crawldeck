import { fixtureAdapter } from './fixtureAdapter.js';
import type { CrawlAdapter } from './types.js';

const adapters: Record<string, CrawlAdapter> = {
  [fixtureAdapter.name]: fixtureAdapter
};

export function listAdapters(): string[] {
  return Object.keys(adapters).sort();
}

export function getAdapter(name: string): CrawlAdapter {
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`Unknown crawler adapter '${name}'. Available: ${listAdapters().join(', ')}`);
  }
  return adapter;
}

export type AdapterFactory = () => CrawlAdapter;

export function adapterSeam(name: string, factory: AdapterFactory): void {
  if (adapters[name]) throw new Error(`Adapter '${name}' is already registered.`);
  adapters[name] = factory();
}
