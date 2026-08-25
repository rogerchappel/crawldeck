import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('release tag accepts the package version tag', async () => {
  const result = await execFileAsync(process.execPath, ['scripts/check-release-tag.mjs', 'v0.1.0']);
  assert.match(result.stdout, /matches package version 0\.1\.0/);
});

test('release tag rejects a tag for another package version', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/check-release-tag.mjs', 'v9.9.9']),
    (error) => error.code === 1 && /v9\.9\.9 does not match package version tag v0\.1\.0/.test(error.stderr)
  );
});
