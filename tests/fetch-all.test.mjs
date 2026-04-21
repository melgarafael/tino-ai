// tests/fetch-all.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'fetch-all.mjs');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'rss');
const CONFIG_TEST = path.join(FIXTURE_DIR, 'sources.test.yaml');

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SCRIPT, ...args], { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err && err.code !== 0 && typeof err.code === 'number') {
        // still resolve to inspect summary/stderr
        resolve({ code: err.code, stdout, stderr });
        return;
      }
      if (err) { reject(err); return; }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

async function mkTmp() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-fetch-test-'));
  return base;
}

test('fetch-all: fixture mode gera um JSON por fonte', async () => {
  const out = await mkTmp();
  const { code, stdout } = await runScript([
    '--config', CONFIG_TEST,
    '--fixture-dir', FIXTURE_DIR,
    '--out', out,
    '--limit', '20',
    '--since', '2020-01-01T00:00:00Z',
    '--force',
  ]);
  assert.equal(code, 0);

  const summary = JSON.parse(stdout);
  assert.equal(summary.fontes, 3);
  assert.equal(summary.erros.length, 0);
  assert.ok(summary.items_por_fonte['anthropic-sample'] >= 1);
  assert.ok(summary.items_por_fonte['atom-sample'] >= 1);
  assert.ok(summary.items_por_fonte['malformed'] >= 1);

  const files = await fs.readdir(out);
  assert.ok(files.includes('anthropic-sample.json'));
  assert.ok(files.includes('atom-sample.json'));
  assert.ok(files.includes('malformed.json'));
});

test('fetch-all: cada item do JSON tem schema completo', async () => {
  const out = await mkTmp();
  await runScript([
    '--config', CONFIG_TEST,
    '--fixture-dir', FIXTURE_DIR,
    '--out', out,
    '--limit', '20',
    '--since', '2020-01-01T00:00:00Z',
    '--force',
  ]);
  const raw = await fs.readFile(path.join(out, 'anthropic-sample.json'), 'utf8');
  const items = JSON.parse(raw);
  assert.ok(Array.isArray(items));
  assert.ok(items.length >= 1);
  for (const it of items) {
    assert.equal(typeof it.id, 'string');
    assert.equal(typeof it.titulo, 'string');
    assert.equal(typeof it.url, 'string');
    assert.equal(typeof it.data, 'string');
    assert.equal(typeof it.resumo_bruto, 'string');
    assert.equal(typeof it.fonte, 'string');
    assert.equal(it.fonte, 'anthropic-sample');
    assert.equal(typeof it.tipo, 'string');
  }
});

test('fetch-all: --limit respeitado', async () => {
  const out = await mkTmp();
  const { code, stdout } = await runScript([
    '--config', CONFIG_TEST,
    '--fixture-dir', FIXTURE_DIR,
    '--out', out,
    '--limit', '2',
    '--since', '2020-01-01T00:00:00Z',
    '--force',
  ]);
  assert.equal(code, 0);
  const summary = JSON.parse(stdout);
  assert.ok(summary.items_por_fonte['anthropic-sample'] <= 2);
  const items = JSON.parse(await fs.readFile(path.join(out, 'anthropic-sample.json'), 'utf8'));
  assert.equal(items.length, 2);
});

test('fetch-all: --since filtra items antigos', async () => {
  const out = await mkTmp();
  await runScript([
    '--config', CONFIG_TEST,
    '--fixture-dir', FIXTURE_DIR,
    '--out', out,
    '--limit', '20',
    '--since', '2026-04-20T00:00:00Z',
    '--force',
  ]);
  const items = JSON.parse(await fs.readFile(path.join(out, 'anthropic-sample.json'), 'utf8'));
  // Dos 3 items do fixture, apenas 1 tem data >= 2026-04-20 (21 abr)
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, 'Claude Managed Agents GA');
});
