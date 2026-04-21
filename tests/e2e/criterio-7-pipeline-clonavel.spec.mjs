// Criterio projeto-clonavel — "Qualquer pessoa clona o repo e roda o pipeline."
// Sanity check: o pipeline (fetch-all + rank) gira do zero contra as fixtures RSS,
// produzindo pelo menos 1 arquivo .md de novidade no diretorio de saida.

import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

test.describe('criterio projeto-clonavel · pipeline roda do zero', () => {
  test('fetch-all + rank geram >= 1 arquivo .md contra fixtures', async () => {
    test.setTimeout(30_000);

    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-e2e-'));
    const cacheDir = path.join(tmpBase, 'cache');
    const outDir = path.join(tmpBase, 'novidades');
    const fixtureDir = path.join(PROJECT_ROOT, 'tests/fixtures/rss');
    const profile = path.join(PROJECT_ROOT, 'tino-vault-sample/perfil-raw/Tino/_perfil.md');

    // 1) fetch-all contra fixtures
    const fetchStdout = execFileSync('node', [
      path.join(PROJECT_ROOT, 'scripts/fetch-all.mjs'),
      '--fixture-dir', fixtureDir,
      '--out', cacheDir,
      '--limit', '5',
      '--force',
    ], { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15_000 });

    const fetchSummary = JSON.parse(fetchStdout);
    expect(fetchSummary.fontes).toBeGreaterThanOrEqual(1);
    expect(fetchSummary.items_total).toBeGreaterThanOrEqual(1);

    // 2) rank em modo mock
    const rankStdout = execFileSync('node', [
      path.join(PROJECT_ROOT, 'scripts/rank.mjs'),
      '--profile', profile,
      '--cache-dir', cacheDir,
      '--out-dir', outDir,
      '--mock',
    ], { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15_000 });

    const rankSummary = JSON.parse(rankStdout);
    expect(rankSummary.ranqueados).toBeGreaterThanOrEqual(1);

    // 3) ao menos 1 arquivo .md no outDir
    const files = await fs.readdir(outDir);
    const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThanOrEqual(1);

    // cleanup best-effort
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
  });
});
