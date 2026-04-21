#!/usr/bin/env node
// scripts/fetch-all.mjs
// CLI: busca todas as fontes configuradas e grava JSON normalizado por fonte.
//
// Flags:
//   --config <path>        (default: config/sources.default.yaml)
//   --out <dir>            (default: .tino-cache/raw/<YYYY-MM-DD>/)
//   --fixture-dir <path>   (le <fixture-dir>/<source-id>.xml em vez de HTTP)
//   --limit <N>            (maximo de items por fonte; default 20)
//   --since <ISO>          (ignora items com data < since; default: 7 dias atras)
//   --force                (sobrescreve cache do dia)
//
// Saida: um JSON por fonte em <out>/<source-id>.json + summary JSON em stdout
// Schema do item:
//   { id, titulo, url, data, resumo_bruto, fonte, tipo, fonte_interna }
//
// Erros por fonte sao capturados — nao derrubam o batch. O summary agrega erros.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { fetchText } from '../lib/fetch.mjs';
import { parseFeed } from '../lib/rss-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    config: null,
    out: null,
    fixtureDir: null,
    limit: 20,
    since: null,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--config') args.config = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--fixture-dir') args.fixtureDir = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  const msg = [
    'fetch-all — coleta itens de fontes RSS/Atom para o Tino',
    '',
    'Uso:',
    '  node scripts/fetch-all.mjs [opcoes]',
    '',
    'Opcoes:',
    '  --config <path>       YAML de fontes (default: config/sources.default.yaml)',
    '  --out <dir>           diretorio de saida (default: .tino-cache/raw/<YYYY-MM-DD>/)',
    '  --fixture-dir <path>  le <fixture-dir>/<source-id>.xml em vez de HTTP',
    '  --limit <N>           max itens por fonte (default 20)',
    '  --since <ISO>         ignora itens anteriores a essa data (default: 7 dias atras)',
    '  --force               sobrescreve JSONs ja existentes',
  ].join('\n');
  process.stdout.write(msg + '\n');
}

function todayStamp(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sinceDefault() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

function inferTipo(source) {
  const hay = `${source.id || ''} ${source.name || ''}`.toLowerCase();
  if (/changelog|release/.test(hay)) return 'release';
  if (/paper|arxiv|research/.test(hay)) return 'paper';
  if (/reddit|hn|hacker/.test(hay)) return 'community';
  if (/github|trending/.test(hay)) return 'repo';
  if (/blog|news|rundown|bites|bens/.test(hay)) return 'news';
  return 'news';
}

async function loadConfig(configPath) {
  const abs = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  const text = await fs.readFile(abs, 'utf8');
  const parsed = parseYaml(text) || {};
  const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  return sources;
}

async function readFixture(fixtureDir, sourceId) {
  const abs = path.resolve(fixtureDir, `${sourceId}.xml`);
  return fs.readFile(abs, 'utf8');
}

function filterAndLimit(items, { since, limit }) {
  const sinceMs = since ? Date.parse(since) : null;
  const filtered = [];
  for (const it of items) {
    if (sinceMs && it.data) {
      const t = Date.parse(it.data);
      if (!Number.isNaN(t) && t < sinceMs) continue;
    }
    filtered.push(it);
  }
  if (limit && filtered.length > limit) return filtered.slice(0, limit);
  return filtered;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  const text = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, text + '\n', 'utf8');
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function processSource(source, { fixtureDir, limit, since, outDir, force }) {
  const outFile = path.join(outDir, `${source.id}.json`);
  if (!force && await pathExists(outFile)) {
    const existing = JSON.parse(await fs.readFile(outFile, 'utf8'));
    const count = Array.isArray(existing) ? existing.length : 0;
    return { source, count, skipped: true, file: outFile };
  }

  let xmlText;
  if (fixtureDir) {
    xmlText = await readFixture(fixtureDir, source.id);
  } else {
    xmlText = await fetchText(source.url);
  }

  const { items } = parseFeed(xmlText);
  const tipo = inferTipo(source);
  const enriched = items.map((it) => ({
    ...it,
    fonte: source.id,
    tipo,
  }));
  const final = filterAndLimit(enriched, { since, limit });

  await writeJson(outFile, final);
  return { source, count: final.length, skipped: false, file: outFile };
}

async function discoverFixtureSources(fixtureDir) {
  const entries = await fs.readdir(fixtureDir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith('.xml')) continue;
    const id = e.name.replace(/\.xml$/i, '');
    out.push({ id, name: id, type: 'rss', url: `fixture://${id}`, active: true, weight: 1.0 });
  }
  return out;
}

// runFetchAll: executa a logica de fetch-all a partir de um objeto de opcoes.
// Retorna { summary } sem escrever em stdout nem encerrar o processo.
// Opcoes aceitas: { config, out, fixtureDir, limit, since, force, sourcesOverride }
// - sourcesOverride: array ja resolvido de fontes; se presente, skipa loadConfig.
async function runFetchAll(opts = {}) {
  const outDir = opts.out ?? path.join(PROJECT_ROOT, '.tino-cache', 'raw', todayStamp());
  const since = opts.since ?? sinceDefault();
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : 20;

  let sources;
  if (Array.isArray(opts.sourcesOverride)) {
    sources = opts.sourcesOverride;
  } else if (opts.fixtureDir && !opts.config) {
    sources = await discoverFixtureSources(opts.fixtureDir);
  } else {
    const configPath = opts.config ?? path.join(PROJECT_ROOT, 'config/sources.default.yaml');
    sources = await loadConfig(configPath);
  }
  if (sources.length === 0) {
    return {
      summary: {
        fontes: 0,
        items_total: 0,
        items_por_fonte: {},
        erros: [{ reason: 'no sources in config', configPath: opts.config ?? null }],
        out: outDir,
      },
    };
  }

  await ensureDir(outDir);

  const targets = [];
  for (const s of sources) {
    if (opts.fixtureDir) {
      const p = path.resolve(opts.fixtureDir, `${s.id}.xml`);
      if (await pathExists(p)) targets.push(s);
    } else {
      if (s.active === false) continue;
      if (s.type && s.type !== 'rss' && s.type !== 'atom') continue;
      targets.push(s);
    }
  }

  const itemsPorFonte = {};
  const erros = [];
  let itemsTotal = 0;

  for (const s of targets) {
    try {
      const { count, skipped, file } = await processSource(s, {
        fixtureDir: opts.fixtureDir,
        limit,
        since,
        outDir,
        force: opts.force,
      });
      itemsPorFonte[s.id] = count;
      itemsTotal += count;
      void skipped; void file;
    } catch (e) {
      erros.push({
        id: s.id,
        url: e?.url ?? s.url,
        status: e?.status ?? null,
        reason: e?.reason ?? e?.message ?? String(e),
      });
    }
  }

  const summary = {
    fontes: targets.length,
    items_total: itemsTotal,
    items_por_fonte: itemsPorFonte,
    erros,
    out: outDir,
  };
  return { summary };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { summary } = await runFetchAll({
    config: args.config,
    out: args.out,
    fixtureDir: args.fixtureDir,
    limit: args.limit,
    since: args.since,
    force: args.force,
  });
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  if (summary.fontes === 0) process.exit(1);
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  main().catch((e) => {
    process.stderr.write(`fatal: ${e?.stack || e?.message || String(e)}\n`);
    process.exit(2);
  });
}

export { main, parseArgs, inferTipo, filterAndLimit, runFetchAll };
