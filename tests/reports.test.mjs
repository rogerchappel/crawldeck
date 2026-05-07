import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHealth, renderReport } from '../dist/index.js';

const state = {
  version: 1,
  profiles: [{ id: 'p1', name: 'demo', adapter: 'fixture', fixturePath: 'fixtures', outputDir: 'out', createdAt: 'now', updatedAt: 'now' }],
  jobs: [{ id: 'j1', profileId: 'p1', status: 'completed', createdAt: 'now', updatedAt: 'now', totalItems: 2, processedItems: 2, errors: [], outputDir: 'out' }]
};

test('health output summarizes queue counts', () => {
  assert.match(renderHealth(state), /completed: 1/);
});

test('report output includes processed item counts', () => {
  assert.match(renderReport(state), /processed items: 2/);
});
