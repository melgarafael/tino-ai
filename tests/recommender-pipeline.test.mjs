import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { runPipeline } from '../lib/recommender-pipeline.mjs';
import { startMockServer } from './fixtures/aitmpl/mock-server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/recomendacao.schema.json'), 'utf8')
);
const MOCK_CURATED = path.join(ROOT, 'tests/fixtures/curated-stack-mock.yaml');

let mock; let cacheDir;

before(async () => { mock = await startMockServer(); });
after(async () => { if (mock) await mock.stop(); });
beforeEach(async () => { cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-pipe-')); });

function extractFm(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(SCHEMA);
}

const perfilJunior = {
  schema_version: 1,
  papel: 'junior',
  experiencia_dev: 'iniciante',
  plano_claude: 'pro',
  sistema: 'darwin',
  linguagens_familiares: ['javascript'],
  tipo_projeto: ['webapp'],
  modo_autonomia: 'balanceado',
  tolerancia_risco: 'media',
  intervencao_hooks: 'ativa',
  ja_tem_instalado: { skills: [], agents: [], mcps: [], plugins: [], hooks: [] },
};

test('runPipeline: produz markdown que valida no schema do recomendacao', async () => {
  const md = await runPipeline({
    perfil: perfilJunior,
    curatedStackPath: MOCK_CURATED,
    baseUrl: mock.baseUrl,
    cacheDir,
    ttlMs: 60_000,
  });
  const fm = extractFm(md);
  const v = makeValidator();
  assert.equal(v(fm), true, JSON.stringify(v.errors, null, 2));
  assert.ok(fm.counts.total >= 1);
});

test('runPipeline: aitmpl indisponivel -> ainda funciona com so curated', async () => {
  mock.setFailMode(true);
  try {
    const md = await runPipeline({
      perfil: perfilJunior,
      curatedStackPath: MOCK_CURATED,
      baseUrl: mock.baseUrl,
      cacheDir,
      ttlMs: 60_000,
    });
    const fm = extractFm(md);
    assert.ok(fm.counts.total >= 1, 'deveria ter items do curated mesmo sem aitmpl');
    assert.equal(fm.counts.extras_aitmpl, 0);
  } finally {
    mock.setFailMode(false);
  }
});

test('runPipeline: items ja_tem_instalado nao aparecem', async () => {
  const perfil = { ...perfilJunior, ja_tem_instalado: { ...perfilJunior.ja_tem_instalado, plugins: ['superpowers'] } };
  const md = await runPipeline({
    perfil,
    curatedStackPath: MOCK_CURATED,
    baseUrl: mock.baseUrl,
    cacheDir,
    ttlMs: 60_000,
    fetchExtras: false,
  });
  const fm = extractFm(md);
  assert.ok(!fm.items.some((i) => i.name === 'superpowers'));
});
