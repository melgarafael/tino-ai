#!/usr/bin/env node
// scripts/generate-dashboard-data.mjs
// Lê um vault Tino e emite dashboard-data.json ao lado do dashboard.html.
// Quando o dashboard é aberto via HTTP local, ele fetcha esse arquivo e
// mostra os dados reais no modo demo (sem precisar conectar vault).
//
// Uso:
//   node scripts/generate-dashboard-data.mjs --vault <path> [--out <path>]
//
// Default:
//   --vault tino-vault-sample/perfil-raw
//   --out   dashboard-data.json

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseFm } from '../lib/frontmatter.mjs';

function parseArgs(argv) {
  const args = { vault: 'tino-vault-sample/perfil-raw', out: 'dashboard-data.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--vault') args.vault = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

async function readIfExists(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

function hydrateProfile(parsed) {
  const m = parsed.meta || {};
  const sections = { identidade: '', foco: '', evita_body: '' };
  const parts = String(parsed.body || '').split(/^##\s+/m);
  parts.forEach((p) => {
    const [head, ...rest] = p.split(/\r?\n/);
    const content = rest.join('\n').trim();
    const h = String(head || '').trim().toLowerCase();
    if (h.startsWith('identidade')) sections.identidade = content;
    else if (h.startsWith('foco')) sections.foco = content;
    else if (h.startsWith('evita')) sections.evita_body = content;
  });
  return {
    meta: {
      nome: String(m.nome || ''),
      atualizado: String(m.atualizado || ''),
      foco_ativo: Array.isArray(m.foco_ativo) ? m.foco_ativo : [],
      identidade: Array.isArray(m.identidade) ? m.identidade : [],
      evita: Array.isArray(m.evita) ? m.evita : [],
      processadas: Number(m.processadas) || 0,
      favoritadas: Number(m.favoritadas) || 0,
      thumb_up: Number(m.thumb_up) || 0,
      thumb_down: Number(m.thumb_down) || 0,
      acerto: Number(m.acerto) || 0,
    },
    identidade: sections.identidade,
    foco: sections.foco,
    evita_body: sections.evita_body,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tinoDir = path.join(args.vault, 'Tino');
  const perfilRaw = await readIfExists(path.join(tinoDir, '_perfil.md'));
  const configRaw = await readIfExists(path.join(tinoDir, '_config.md'));
  const novDir = path.join(tinoDir, 'novidades');

  const profile = perfilRaw ? hydrateProfile(parseFm(perfilRaw)) : null;
  const config = configRaw ? parseFm(configRaw) : null;

  const news = [];
  try {
    const files = await fs.readdir(novDir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const raw = await fs.readFile(path.join(novDir, f), 'utf8');
      const { meta, body } = parseFm(raw);
      news.push({
        id: String(meta.id || f.replace(/\.md$/, '')),
        titulo: String(meta.titulo || '(sem título)'),
        fonte: String(meta.fonte || ''),
        data: String(meta.data || ''),
        tipo: String(meta.tipo || ''),
        nota: Number(meta.nota) || 0,
        veredito: String(meta.veredito || ''),
        resumo: String(meta.resumo || ''),
        cite: String(meta.cite || ''),
        url: String(meta.url || ''),
        favorito: meta.favorito === true,
        body: String(body || ''),
      });
    }
    news.sort((a, b) => (b.nota - a.nota) || String(b.data).localeCompare(String(a.data)));
  } catch { /* no novidades yet */ }

  const payload = {
    meta: { source: args.vault, generated_at: new Date().toISOString(), count: news.length },
    news,
    profile,
    config,
  };

  await fs.writeFile(args.out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, out: args.out, news: news.length, vault: args.vault }, null, 2));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
