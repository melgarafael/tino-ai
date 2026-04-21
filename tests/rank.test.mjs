// tests/rank.test.mjs
// Integration tests para scripts/rank.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from '../lib/frontmatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'rank.mjs');
const PERFIL_SAMPLE = path.join(PROJECT_ROOT, 'tino-vault-sample', 'perfil-raw', 'Tino', '_perfil.md');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SCRIPT, ...args], { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err && typeof err.code === 'number') {
        resolve({ code: err.code, stdout, stderr });
        return;
      }
      if (err) { reject(err); return; }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

async function mkTmpDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function seedCache(cacheDir, items) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    path.join(cacheDir, 'fixture.json'),
    JSON.stringify(items, null, 2),
    'utf8',
  );
}

const SAMPLE_ITEMS = [
  {
    id: 'anthropic-agent-sdk-1-0-2026',
    titulo: 'Claude Agent SDK 1.0',
    url: 'https://www.anthropic.com/news/claude-agent-sdk-1-0',
    data: daysAgo(1),
    resumo_bruto: 'Stable APIs for tool orchestration and streaming.',
    fonte: 'anthropic-sample',
    tipo: 'news',
  },
  {
    id: 'runway-gen4-2026',
    titulo: 'Runway Gen-4 video generation',
    url: 'https://runway.ml/gen4',
    data: daysAgo(2),
    resumo_bruto: 'New model beats Sora at video generation.',
    fonte: 'runway-sample',
    tipo: 'news',
  },
  {
    id: 'pasta-news-2026',
    titulo: 'Pasta carbonara the italian way',
    url: 'https://food.example/pasta',
    data: daysAgo(30),
    resumo_bruto: 'A tutorial on the original carbonara.',
    fonte: 'food-sample',
    tipo: 'news',
  },
];

test('rank: gera um .md por item no out-dir', async () => {
  const cacheDir = await mkTmpDir('tino-rank-cache-');
  const outDir = await mkTmpDir('tino-rank-out-');
  await seedCache(cacheDir, SAMPLE_ITEMS);

  const { code, stdout } = await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
  ]);
  assert.equal(code, 0, `stderr: ${stdout}`);
  const summary = JSON.parse(stdout);
  assert.equal(summary.ranqueados, 3);

  const files = await fs.readdir(outDir);
  assert.equal(files.length, 3);
  for (const f of files) assert.ok(f.endsWith('.md'));
});

test('rank: cada .md gerado eh parseavel e tem nota em [0,10]', async () => {
  const cacheDir = await mkTmpDir('tino-rank-cache-');
  const outDir = await mkTmpDir('tino-rank-out-');
  await seedCache(cacheDir, SAMPLE_ITEMS);

  await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
  ]);

  const files = await fs.readdir(outDir);
  for (const f of files) {
    const text = await fs.readFile(path.join(outDir, f), 'utf8');
    const { meta, body } = parse(text);
    for (const k of ['id', 'titulo', 'fonte', 'data', 'tipo', 'nota', 'veredito', 'resumo', 'cite', 'url', 'favorito']) {
      assert.ok(k in meta, `campo ${k} faltando em ${f}`);
    }
    assert.equal(typeof meta.nota, 'number');
    assert.ok(meta.nota >= 0 && meta.nota <= 10);
    assert.equal(typeof meta.favorito, 'boolean');
    assert.ok(['Foca', 'Considera', 'Acompanha', 'Ignore'].includes(meta.veredito));
    assert.ok(body.length > 0, `body vazio em ${f}`);
  }
});

test('rank: --dry-run nao escreve arquivos', async () => {
  const cacheDir = await mkTmpDir('tino-rank-cache-');
  const outDir = await mkTmpDir('tino-rank-out-');
  await seedCache(cacheDir, SAMPLE_ITEMS);

  const { code, stdout } = await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
    '--dry-run',
  ]);
  assert.equal(code, 0);
  const summary = JSON.parse(stdout);
  assert.equal(summary.ranqueados, 3);
  assert.equal(summary.dry_run, true);

  const files = await fs.readdir(outDir).catch(() => []);
  assert.equal(files.length, 0);
});

test('rank: preserva favorito=true ao re-rankear', async () => {
  const cacheDir = await mkTmpDir('tino-rank-cache-');
  const outDir = await mkTmpDir('tino-rank-out-');
  await seedCache(cacheDir, SAMPLE_ITEMS);

  // 1a rodada
  await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
  ]);

  // marca um como favorito
  const files = await fs.readdir(outDir);
  const target = files[0];
  const targetPath = path.join(outDir, target);
  const original = await fs.readFile(targetPath, 'utf8');
  const { meta, body } = parse(original);
  meta.favorito = true;
  const { serialize } = await import('../lib/frontmatter.mjs');
  await fs.writeFile(targetPath, serialize(meta, body) + '\n', 'utf8');

  // re-rankeia
  await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
  ]);

  const after = await fs.readFile(targetPath, 'utf8');
  const parsed = parse(after);
  assert.equal(parsed.meta.favorito, true, 'favorito deveria ter sido preservado');
});

test('rank: novidade Claude (foco_ativo sample) recebe nota >= 7', async () => {
  const cacheDir = await mkTmpDir('tino-rank-cache-');
  const outDir = await mkTmpDir('tino-rank-out-');
  await seedCache(cacheDir, SAMPLE_ITEMS);

  await run([
    '--profile', PERFIL_SAMPLE,
    '--cache-dir', cacheDir,
    '--out-dir', outDir,
    '--mock',
  ]);

  const files = await fs.readdir(outDir);
  const claudeFile = files.find((f) => f.includes('agent-sdk'));
  assert.ok(claudeFile, 'arquivo do claude agent sdk nao encontrado');
  const text = await fs.readFile(path.join(outDir, claudeFile), 'utf8');
  const { meta } = parse(text);
  assert.ok(meta.nota >= 7, `esperava >= 7, recebi ${meta.nota}`);
});
