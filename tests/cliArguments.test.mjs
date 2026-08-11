import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve('dist/cli.js');

async function run(args, cwd) {
  return execFileAsync(process.execPath, [cliPath, ...args], { cwd });
}

async function rejectsWithoutState(args, message) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'crawldeck-cli-'));
  await assert.rejects(run(args, cwd), (error) => {
    assert.match(error.stderr, message);
    return true;
  });
  await assert.rejects(stat(path.join(cwd, '.crawldeck')), { code: 'ENOENT' });
}

test('init rejects an unexpected operand before creating state', async () => {
  await rejectsWithoutState(['init', 'unexpected-operand'], /crawldeck: init does not accept: unexpected-operand/);
});

test('report rejects a misspelled option before reading state', async () => {
  await rejectsWithoutState(['report', '--jsno'], /crawldeck: report does not accept: --jsno/);
});

test('--deck-dir rejects a missing value before dispatch', async () => {
  await rejectsWithoutState(['init', '--deck-dir'], /crawldeck: --deck-dir requires a directory value/);
});

test('documented global options remain valid before and after commands', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'crawldeck-cli-'));
  const deckDir = path.join(cwd, 'custom-deck');
  const initialized = await run(['--deck-dir', deckDir, 'init'], cwd);
  assert.match(initialized.stdout, new RegExp(`Initialized crawldeck at ${deckDir}`));

  const report = await run(['report', '--json', '--deck-dir', deckDir], cwd);
  assert.deepEqual(JSON.parse(report.stdout), { version: 1, profiles: [], jobs: [] });
});

test('profile add accepts its documented option grammar', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'crawldeck-cli-'));
  const result = await run(['profile', 'add', 'sample', '--fixture', path.resolve('fixtures/sample-site'), '--json'], cwd);
  assert.equal(JSON.parse(result.stdout).name, 'sample');
});
