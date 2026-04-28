import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveHomePath } from '../lib/tino-home.mjs';

let tmpHome;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-home-test-'));
});

test('resolveHomePath: le TINO_HOME de config.sh', async () => {
  await fs.mkdir(path.join(tmpHome, '.tino'), { recursive: true });
  const cfg = `export TINO_HOME="/path/to/tino"\nexport TINO_VAULT_PATH="/path/to/vault"\n`;
  await fs.writeFile(path.join(tmpHome, '.tino', 'config.sh'), cfg);
  const result = await resolveHomePath({ homeDir: tmpHome });
  assert.equal(result, '/path/to/tino');
});

test('resolveHomePath: arquivo ausente retorna null', async () => {
  const result = await resolveHomePath({ homeDir: tmpHome });
  assert.equal(result, null);
});
