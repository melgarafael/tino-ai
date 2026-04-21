#!/usr/bin/env node
// scripts/rank-claude.mjs
// Re-ranqueia novidades do vault via `claude -p` headless.
// Gera justificativas REAIS citando perfil/vault, substituindo o output do ranker mock.
//
// Flags:
//   --vault <path>         (obrigatório)
//   --only-foca            ranqueia só items com nota >= 9 (mais rápido, foco no topo)
//   --batch <N>            items por call (default 15)
//   --dry-run              não reescreve, só imprime resultado
//   --limit <N>            máximo de items totais

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import crypto from 'node:crypto';
import { parse as parseFm, serialize as serializeFm } from '../lib/frontmatter.mjs';

function parseArgs(argv) {
  const args = { vault: null, onlyFoca: false, batch: 15, dryRun: false, limit: 999 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--vault') args.vault = argv[++i];
    else if (a === '--only-foca') args.onlyFoca = true;
    else if (a === '--batch') args.batch = Number(argv[++i]);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`
rank-claude — re-ranqueia novidades via Claude headless com justificativa real.

Uso:
  node scripts/rank-claude.mjs --vault <path> [--only-foca] [--batch N] [--dry-run] [--limit N]

Exemplo:
  node scripts/rank-claude.mjs --vault ~/Obsidian/MeuVault --only-foca
`);
}

async function loadProfile(vault) {
  const p = path.join(vault, 'Tino', '_perfil.md');
  const raw = await fs.readFile(p, 'utf8');
  return parseFm(raw);
}

async function listNovidades(vault, { onlyFoca, limit }) {
  const dir = path.join(vault, 'Tino', 'novidades');
  const files = await fs.readdir(dir);
  const items = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(dir, f);
    const raw = await fs.readFile(full, 'utf8');
    const parsed = parseFm(raw);
    const nota = Number(parsed.meta.nota) || 0;
    if (onlyFoca && nota < 9) continue;
    items.push({ file: f, full, meta: parsed.meta, body: parsed.body });
    if (items.length >= limit) break;
  }
  return items;
}

function buildPrompt(perfil, batch) {
  const perfilText = `---\n${Object.entries(perfil.meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${perfil.body}`;
  const batchJson = JSON.stringify(
    batch.map((it) => ({
      id: String(it.meta.id || '').slice(0, 80),
      titulo: String(it.meta.titulo || '').slice(0, 200),
      fonte: String(it.meta.fonte || ''),
      data: String(it.meta.data || ''),
      resumo_bruto: String(it.meta.resumo || it.body || '').slice(0, 400),
    })),
    null,
    2,
  );

  return `Você é o Ranker do Tino, um curador local-first de novidades de IA. Sua tarefa é ranquear cada novidade da lista abaixo contra o perfil do usuário, produzindo JSON estruturado.

## Perfil do usuário (extraído do vault Obsidian dele)

${perfilText}

## Regras de calibração

- **Nota 9.0–10.0 (Foca)**: altamente aplicável HOJE. Menciona item específico de foco_ativo OU resolve problema conhecido citado no perfil. Deve ser algo que o usuário provavelmente vai AGIR em cima essa semana.
- **Nota 7.0–8.9 (Considera)**: relevante contextual, alinhado com identidade mas não urgente.
- **Nota 5.0–6.9 (Acompanha)**: interessante mas fora do momento atual.
- **Nota < 5.0 (Ignore)**: fora do contexto, em evita, ou "ruído da indústria" sem aplicação pro usuário.

## Regra crítica da justificativa

A justificativa NÃO pode ser genérica. Deve:
1. Mencionar qual termo/trecho ESPECÍFICO do perfil ativou (ex: "foco_ativo inclui Claude Agent SDK")
2. Explicar o COMO a novidade se conecta com um projeto/interesse concreto do usuário
3. Quando der, sugerir uma ação (estudar, migrar código, agendar leitura, descartar)
4. Zero boilerplate tipo "baseado em heurística", "match determinístico"

## Regra da citação (cite)

O campo \`cite\` deve apontar para UM arquivo do perfil ou do vault que motivou a nota.
- Se o trigger está em foco_ativo → cite: "_perfil.md · foco_ativo"
- Se está em identidade → cite: "_perfil.md · identidade"
- Se está em evita → cite: "_perfil.md · evita"

## Items para ranquear

\`\`\`json
${batchJson}
\`\`\`

## Output

Responda SOMENTE com um array JSON (sem markdown, sem texto antes ou depois). Cada objeto deve ter:

\`\`\`
{
  "id": "<mesmo id do input>",
  "nota": <number 0-10 com 1 casa decimal>,
  "veredito": "Foca" | "Considera" | "Acompanha" | "Ignore",
  "resumo": "<1 linha curta explicando do que é a novidade>",
  "justificativa": "<2-4 frases específicas conectando com o perfil>",
  "cite": "_perfil.md · foco_ativo" | "_perfil.md · identidade" | "_perfil.md · evita"
}
\`\`\`

Importante: resposta DEVE ser JSON array puro, começando com [ e terminando com ].
`;
}

async function callClaude(prompt) {
  // Salva prompt em arquivo temp e passa via stdin redirect, que o Claude CLI respeita.
  const tmpFile = path.join(os.tmpdir(), `tino-rank-${crypto.randomBytes(4).toString('hex')}.txt`);
  await fs.writeFile(tmpFile, prompt, 'utf8');
  try {
    const stdout = await new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', `claude -p --output-format json < "${tmpFile}"`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '', err = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout after 180s')); }, 180000);
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`));
        else resolve(out);
      });
    });
    const envelope = JSON.parse(stdout);
    if (envelope.is_error) throw new Error(envelope.result || 'claude returned error');
    const text = envelope.result || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`resposta sem JSON array: ${text.slice(0, 300)}`);
    return { rankings: JSON.parse(match[0]), costUsd: envelope.total_cost_usd || 0 };
  } finally {
    try { await fs.unlink(tmpFile); } catch {}
  }
}

async function rankAll(vault, args) {
  const profile = await loadProfile(vault);
  const items = await listNovidades(vault, args);
  console.log(`→ ${items.length} items a ranquear via Claude`);
  if (items.length === 0) return;

  const batches = [];
  for (let i = 0; i < items.length; i += args.batch) {
    batches.push(items.slice(i, i + args.batch));
  }
  console.log(`→ ${batches.length} batch(es) de até ${args.batch} items`);

  let totalCost = 0;
  const rankingsById = new Map();

  for (let bi = 0; bi < batches.length; bi += 1) {
    const batch = batches[bi];
    process.stdout.write(`  batch ${bi + 1}/${batches.length} (${batch.length} items)...`);
    const prompt = buildPrompt(profile, batch);
    try {
      const { rankings, costUsd } = await callClaude(prompt);
      totalCost += costUsd;
      for (const r of rankings) rankingsById.set(r.id, r);
      process.stdout.write(` ✓ ${rankings.length} ranked · $${costUsd.toFixed(3)}\n`);
    } catch (e) {
      process.stdout.write(` ✗ ${e.message.slice(0, 120)}\n`);
    }
  }

  console.log(`\n→ total: ${rankingsById.size}/${items.length} ranked · $${totalCost.toFixed(3)} USD`);

  if (args.dryRun) {
    console.log('\n--- DRY RUN (não escreveu nada) ---');
    for (const it of items.slice(0, 10)) {
      const r = rankingsById.get(String(it.meta.id));
      if (!r) continue;
      console.log(`\n[${r.nota}] ${r.veredito} · ${it.meta.titulo?.slice(0, 70)}`);
      console.log(`  ${r.resumo}`);
      console.log(`  ↳ ${r.justificativa}`);
    }
    return;
  }

  // Reescreve os .md
  let written = 0;
  for (const it of items) {
    const r = rankingsById.get(String(it.meta.id));
    if (!r) continue;
    const newMeta = {
      ...it.meta,
      nota: Number(r.nota),
      veredito: r.veredito,
      resumo: r.resumo,
      cite: r.cite,
      ranker: 'claude',
      ranked_at: new Date().toISOString().slice(0, 10),
    };
    const body = r.justificativa;
    await fs.writeFile(it.full, serializeFm(newMeta, body), 'utf8');
    written += 1;
  }
  console.log(`→ ${written} arquivos reescritos`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.vault) {
    console.error('erro: --vault obrigatório');
    printHelp();
    process.exit(2);
  }
  try {
    await rankAll(args.vault, args);
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exit(1);
  }
}

main();
