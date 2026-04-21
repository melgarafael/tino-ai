#!/usr/bin/env node
// scripts/refresh.mjs
// Orquestra um ciclo completo de refresh do Tino em um vault Obsidian:
//   1. valida vault + _perfil.md
//   2. mescla fontes (config/sources.default.yaml + overrides em _config.md)
//   3. roda fetch-all (via runFetchAll importado) em .tino-cache/raw/<today>/
//   4. roda rank (via run importado de rank.mjs) para <vault>/Tino/novidades/
//   5. atualiza contadores em _perfil.md e _config.md
//   6. imprime summary JSON + aviso humano se counter >= threshold
//
// Flags:
//   --vault <path>             (obrigatorio)
//   --mock                     usa ranker mock (default na wave atual)
//   --fixture-dir <path>       fixture mode pro fetch-all (testes)
//   --force                    sobrescreve cache do dia
//   --limit <N>                limite de items por fonte
//   --sync-threshold <N>       threshold do aviso profile-sync (default 20)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parse as parseFm, serialize as serializeFm } from '../lib/frontmatter.mjs';
import { runFetchAll } from './fetch-all.mjs';
import { run as runRankScript } from './rank.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCES = path.join(PROJECT_ROOT, 'config', 'sources.default.yaml');

function parseArgs(argv) {
  const args = {
    vault: null,
    mock: false,
    fixtureDir: null,
    force: false,
    limit: 20,
    syncThreshold: 20,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--vault') args.vault = argv[++i];
    else if (a === '--mock') args.mock = true;
    else if (a === '--fixture-dir') args.fixtureDir = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--sync-threshold') args.syncThreshold = Number(argv[++i]);
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'refresh — ciclo completo de refresh do Tino',
    '',
    'Uso:',
    '  node scripts/refresh.mjs --vault <path> [opcoes]',
    '',
    'Opcoes:',
    '  --vault <path>         vault Obsidian (obrigatorio)',
    '  --mock                 usa ranker mock (default nesta wave)',
    '  --fixture-dir <path>   fixture mode pro fetch-all (testes)',
    '  --force                sobrescreve cache do dia',
    '  --limit <N>            limite de items por fonte (default 20)',
    '  --sync-threshold <N>   threshold do aviso profile-sync (default 20)',
  ].join('\n') + '\n');
}

function todayStamp(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

// Le fontes do YAML default + merge com "## Fontes" do _config.md (se houver).
// Override no _config.md: linhas "- source_id https://url" na secao "## Fontes".
async function loadMergedSources(configMdPath) {
  const yamlText = await fs.readFile(DEFAULT_SOURCES, 'utf8');
  const parsed = parseYaml(yamlText) || {};
  const defaults = Array.isArray(parsed.sources) ? parsed.sources : [];

  if (!(await pathExists(configMdPath))) return defaults;
  const raw = await fs.readFile(configMdPath, 'utf8');
  const { body } = parseFm(raw);

  const lines = body.split(/\r?\n/);
  const overrides = [];
  let inFontes = false;
  for (const line of lines) {
    if (/^#{1,6}\s+.*\bfontes\b/i.test(line)) { inFontes = true; continue; }
    if (inFontes && /^#{1,6}\s+/.test(line)) { inFontes = false; continue; }
    if (!inFontes) continue;
    const m = line.match(/^\s*[-*]\s+(\S+)\s+(https?:\/\/\S+)\s*$/);
    if (m) overrides.push({ id: m[1], url: m[2] });
  }

  if (overrides.length === 0) return defaults;
  const byId = new Map(defaults.map((s) => [s.id, s]));
  for (const o of overrides) {
    const existing = byId.get(o.id);
    if (existing) {
      byId.set(o.id, { ...existing, url: o.url });
    } else {
      byId.set(o.id, {
        id: o.id, name: o.id, type: 'rss', url: o.url, active: true, weight: 1.0,
      });
    }
  }
  return [...byId.values()];
}

async function incrementConfigCounter(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  const { meta, body } = parseFm(raw);
  const prev = Number.isFinite(Number(meta.refreshes_desde_ultimo_profile_sync))
    ? Number(meta.refreshes_desde_ultimo_profile_sync)
    : 0;
  const next = prev + 1;
  meta.refreshes_desde_ultimo_profile_sync = next;
  await fs.writeFile(configPath, serializeFm(meta, body), 'utf8');
  return next;
}

async function updatePerfilCounters(perfilPath, { novidadesDir }) {
  // Recontabiliza processadas/favoritadas varrendo novidades/.
  let files = [];
  try { files = await fs.readdir(novidadesDir); } catch { files = []; }
  let processadas = 0;
  let favoritadas = 0;
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.md')) continue;
    const abs = path.join(novidadesDir, f);
    try {
      const txt = await fs.readFile(abs, 'utf8');
      const { meta } = parseFm(txt);
      processadas += 1;
      if (meta.favorito === true) favoritadas += 1;
    } catch { /* skip */ }
  }
  const raw = await fs.readFile(perfilPath, 'utf8');
  const { meta, body } = parseFm(raw);
  meta.processadas = processadas;
  meta.favoritadas = favoritadas;
  meta.atualizado = todayStamp();
  await fs.writeFile(perfilPath, serializeFm(meta, body), 'utf8');
  return { processadas, favoritadas };
}

export async function runRefresh(opts) {
  if (!opts.vault) throw new Error('--vault e obrigatorio');
  const absVault = path.resolve(opts.vault);
  const vaultStat = await fs.stat(absVault).catch(() => null);
  if (!vaultStat || !vaultStat.isDirectory()) {
    throw new Error(`vault nao encontrado: ${absVault}`);
  }

  const tinoDir = path.join(absVault, 'Tino');
  const perfilPath = path.join(tinoDir, '_perfil.md');
  const configMdPath = path.join(tinoDir, '_config.md');
  const novidadesDir = path.join(tinoDir, 'novidades');
  const ajustesPath = path.join(tinoDir, '_ajustes.md');

  if (!(await pathExists(perfilPath))) {
    throw new Error(`${perfilPath} nao encontrado — rode /tino:setup primeiro`);
  }
  await fs.mkdir(novidadesDir, { recursive: true });

  const sources = await loadMergedSources(configMdPath);
  const cacheDir = path.join(PROJECT_ROOT, '.tino-cache', 'raw', todayStamp());

  const fetchOpts = {
    out: cacheDir,
    fixtureDir: opts.fixtureDir,
    limit: Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : 20,
    force: !!opts.force,
  };
  // Em modo fixture, fetch-all auto-descobre pelos xmls; senao, passa sources explicito.
  if (!opts.fixtureDir) fetchOpts.sourcesOverride = sources;

  const { summary: fetchSummary } = await runFetchAll(fetchOpts);

  const { summary: rankSummary } = await runRankScript({
    profile: perfilPath,
    cacheDir,
    outDir: novidadesDir,
    adjustments: (await pathExists(ajustesPath)) ? ajustesPath : null,
    mock: true, // wave atual: so mock suportado
    dryRun: false,
  });

  // Atualiza contadores.
  let syncCounter = 0;
  if (await pathExists(configMdPath)) {
    syncCounter = await incrementConfigCounter(configMdPath);
  }
  const perfilCounters = await updatePerfilCounters(perfilPath, { novidadesDir });

  const threshold = Number.isFinite(opts.syncThreshold) && opts.syncThreshold > 0
    ? opts.syncThreshold
    : 20;
  const syncRecommended = syncCounter >= threshold;
  const syncWarning = syncRecommended
    ? `⚠ profile-sync recomendado (${syncCounter} refreshes since last sync)`
    : null;

  const summary = {
    vault: absVault,
    fetch: fetchSummary,
    rank: rankSummary,
    novidades_criadas: rankSummary.ranqueados,
    processadas: perfilCounters.processadas,
    favoritadas: perfilCounters.favoritadas,
    refreshes_desde_ultimo_profile_sync: syncCounter,
    sync_threshold: threshold,
    sync_recommended: syncRecommended,
    sync_warning: syncWarning,
  };
  return { summary, syncWarning };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.vault) {
    process.stderr.write('erro: --vault e obrigatorio\n');
    printHelp();
    process.exit(2);
  }
  try {
    const { summary, syncWarning } = await runRefresh(args);
    if (syncWarning) process.stdout.write(syncWarning + '\n');
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`fatal: ${e?.stack || e?.message || String(e)}\n`);
    process.exit(2);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) main();

export { parseArgs, loadMergedSources };
