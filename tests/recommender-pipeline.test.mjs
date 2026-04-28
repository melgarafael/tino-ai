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

// Regression test for bug found in 2026-04-28 smoke:
// lib/frontmatter.mjs::parse nao suporta block-style YAML (arrays multi-linha).
// perfil-vibecoder-writer.mjs::write produz block-style via yaml.stringify.
// Esse teste garante que o ciclo completo (writer -> yaml.parse -> runPipeline) funciona.
test('integration: perfil escrito pelo writer eh consumivel pelo runPipeline (via yaml.parse)', async () => {
  const { write } = await import('../lib/perfil-vibecoder-writer.mjs');
  const tmpVault = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-integration-'));

  // 1. Writer escreve perfil via yaml.stringify (block-style)
  const fmInput = {
    schema_version: 1,
    papel: 'junior',
    experiencia_dev: 'iniciante',
    plano_claude: 'pro',
    sistema: 'darwin',
    linguagens_familiares: ['javascript', 'python'],
    stacks_conhecidas: ['react', 'nextjs'],
    tipo_projeto: ['webapp'],
    modo_autonomia: 'balanceado',
    tolerancia_risco: 'media',
    intervencao_hooks: 'silenciosa',
    ja_tem_instalado: { skills: [], agents: [], mcps: [], plugins: [], hooks: [] },
  };
  const filePath = await write(tmpVault, fmInput, { importante: 'x', evitar: 'y', notas: '' });

  // 2. Re-le via yaml.parse (NAO via lib/frontmatter.mjs — esse helper do MVP nao suporta block-style)
  const md = await fs.readFile(filePath, 'utf8');
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  const reparsed = parseYaml(fmMatch[1]);

  // 3. Confirma que arrays/objects sobreviveram ao roundtrip
  assert.ok(Array.isArray(reparsed.linguagens_familiares), 'linguagens_familiares deveria ser array, veio ' + typeof reparsed.linguagens_familiares);
  assert.equal(reparsed.linguagens_familiares.length, 2);
  assert.ok(Array.isArray(reparsed.tipo_projeto));
  assert.ok(reparsed.ja_tem_instalado && typeof reparsed.ja_tem_instalado === 'object');

  // 4. runPipeline aceita o perfil reparseado e produz markdown valido
  const result = await runPipeline({
    perfil: reparsed,
    curatedStackPath: MOCK_CURATED,
    baseUrl: mock.baseUrl,
    cacheDir,
    ttlMs: 60_000,
    fetchExtras: false,
  });
  const fmRes = extractFm(result);
  const v = makeValidator();
  assert.equal(v(fmRes), true, 'recomendacao gerada do perfil reparseado deveria validar contra schema');
});
