// lib/adjustments.mjs
// Helpers para ler/escrever `Tino/_ajustes.md` do vault.
//
// O arquivo tem frontmatter com contadores + body com secoes `## Certeiros` /
// `## Errados` (lista de items no formato `- <id> — <titulo>`).
//
// API:
//   readAdjustments(path)           -> { meta, items: [{ id, titulo, sinal }], body }
//   writeAdjustments(path, data)    -> grava frontmatter + body
//   recordThumb(path, {id, titulo, sinal}) -> idempotente, move item entre
//       secoes se sinal mudou, incrementa/decrementa contadores apropriados.
//
// Sinais validos: 'certeiro' | 'errado'.

import { promises as fs } from 'node:fs';
import { parse as parseFm, serialize as serializeFm } from './frontmatter.mjs';

const SEPARATOR = ' — ';
const SECTION_CERTEIROS = 'Certeiros';
const SECTION_ERRADOS = 'Errados';

function todayStamp(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyState() {
  return {
    meta: {
      atualizado: todayStamp(),
      thumb_up: 0,
      thumb_down: 0,
      ignore_tags: [],
    },
    items: [],
    body: '',
  };
}

// Parseia body em secoes { nome: [linhas...] } preservando ordem original.
function parseSections(body) {
  const sections = [];
  const lines = String(body || '').split(/\r?\n/);
  let current = { name: '', lines: [] };
  sections.push(current);
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      current = { name: h[1].trim(), lines: [] };
      sections.push(current);
    } else {
      current.lines.push(line);
    }
  }
  return sections;
}

function serializeSections(sections) {
  const out = [];
  for (const s of sections) {
    if (s.name) out.push(`## ${s.name}`);
    // Remove trailing empty lines dentro da secao para evitar drift.
    let lines = s.lines.slice();
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    out.push(...lines);
    out.push('');
  }
  // Remove trailing empty da saida global
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

function findSection(sections, name) {
  return sections.find((s) => s.name.toLowerCase() === name.toLowerCase()) || null;
}

function ensureSection(sections, name) {
  let s = findSection(sections, name);
  if (!s) {
    s = { name, lines: [] };
    sections.push(s);
  }
  return s;
}

// Parseia uma linha `- <id> — <titulo>` em { id, titulo } ou null.
function parseItemLine(line) {
  const m = String(line).match(/^\s*[-*]\s+(\S+)\s+(?:—|-|--)\s+(.+?)\s*$/);
  if (!m) return null;
  return { id: m[1], titulo: m[2] };
}

function formatItemLine({ id, titulo }) {
  return `- ${id}${SEPARATOR}${titulo}`;
}

function extractItemsFromSection(section, sinal) {
  const items = [];
  if (!section) return items;
  for (const line of section.lines) {
    const it = parseItemLine(line);
    if (it) items.push({ ...it, sinal });
  }
  return items;
}

function removeItemFromSection(section, id) {
  if (!section) return false;
  const before = section.lines.length;
  section.lines = section.lines.filter((line) => {
    const it = parseItemLine(line);
    if (!it) return true;
    return it.id !== id;
  });
  return section.lines.length !== before;
}

function upsertItemInSection(section, { id, titulo }) {
  // Se ja existe com mesmo id, atualiza titulo. Senao, append.
  let replaced = false;
  section.lines = section.lines.map((line) => {
    const it = parseItemLine(line);
    if (it && it.id === id) {
      replaced = true;
      return formatItemLine({ id, titulo });
    }
    return line;
  });
  if (!replaced) section.lines.push(formatItemLine({ id, titulo }));
  return !replaced;
}

export async function readAdjustments(filePath) {
  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return emptyState();
    throw e;
  }
  const { meta, body } = parseFm(text);
  const sections = parseSections(body);
  const certeiros = extractItemsFromSection(findSection(sections, SECTION_CERTEIROS), 'certeiro');
  const errados = extractItemsFromSection(findSection(sections, SECTION_ERRADOS), 'errado');
  const mergedMeta = {
    atualizado: String(meta.atualizado || todayStamp()),
    thumb_up: Number.isFinite(Number(meta.thumb_up)) ? Number(meta.thumb_up) : 0,
    thumb_down: Number.isFinite(Number(meta.thumb_down)) ? Number(meta.thumb_down) : 0,
    ignore_tags: Array.isArray(meta.ignore_tags) ? meta.ignore_tags : [],
  };
  return {
    meta: mergedMeta,
    items: [...certeiros, ...errados],
    body,
  };
}

export async function writeAdjustments(filePath, data) {
  const meta = {
    atualizado: String(data?.meta?.atualizado || todayStamp()),
    thumb_up: Number.isFinite(Number(data?.meta?.thumb_up)) ? Number(data.meta.thumb_up) : 0,
    thumb_down: Number.isFinite(Number(data?.meta?.thumb_down)) ? Number(data.meta.thumb_down) : 0,
    ignore_tags: Array.isArray(data?.meta?.ignore_tags) ? data.meta.ignore_tags : [],
  };

  const items = Array.isArray(data?.items) ? data.items : [];
  const certeiros = { name: SECTION_CERTEIROS, lines: [] };
  const errados = { name: SECTION_ERRADOS, lines: [] };
  for (const it of items) {
    if (!it || !it.id) continue;
    const line = formatItemLine({ id: it.id, titulo: it.titulo || '' });
    if (it.sinal === 'certeiro') certeiros.lines.push(line);
    else if (it.sinal === 'errado') errados.lines.push(line);
  }

  const sections = [
    { name: '', lines: [] },
    certeiros,
    errados,
    { name: 'Tags a ignorar', lines: ['(edite `ignore_tags` no frontmatter — tags aqui sao penalizadas pelo ranker)'] },
  ];
  const body = serializeSections(sections);
  const text = serializeFm(meta, body) + '\n';
  await fs.writeFile(filePath, text, 'utf8');
}

export async function recordThumb(filePath, { id, titulo, sinal }) {
  if (!id) throw new Error('recordThumb: id obrigatorio');
  if (sinal !== 'certeiro' && sinal !== 'errado') {
    throw new Error(`recordThumb: sinal invalido (${sinal})`);
  }

  // Le estado atual (full body para preservar secoes desconhecidas).
  let meta;
  let body;
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = parseFm(text);
    meta = parsed.meta;
    body = parsed.body;
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      meta = {};
      body = '';
    } else {
      throw e;
    }
  }

  const sections = parseSections(body);
  const certeiros = ensureSection(sections, SECTION_CERTEIROS);
  const errados = ensureSection(sections, SECTION_ERRADOS);

  const sourceSec = sinal === 'certeiro' ? errados : certeiros;
  const targetSec = sinal === 'certeiro' ? certeiros : errados;
  const targetKey = sinal === 'certeiro' ? 'thumb_up' : 'thumb_down';
  const oppositeKey = sinal === 'certeiro' ? 'thumb_down' : 'thumb_up';

  // Se o item ja existe no target, operacao e idempotente (nao duplica, nao reconta).
  const alreadyInTarget = targetSec.lines.some((line) => {
    const it = parseItemLine(line);
    return it && it.id === id;
  });
  const existedInSource = removeItemFromSection(sourceSec, id);

  if (!alreadyInTarget) {
    upsertItemInSection(targetSec, { id, titulo: titulo || '' });
  } else {
    // atualiza titulo se mudou
    upsertItemInSection(targetSec, { id, titulo: titulo || '' });
  }

  const prevUp = Number.isFinite(Number(meta.thumb_up)) ? Number(meta.thumb_up) : 0;
  const prevDown = Number.isFinite(Number(meta.thumb_down)) ? Number(meta.thumb_down) : 0;
  const counters = { thumb_up: prevUp, thumb_down: prevDown };
  if (!alreadyInTarget) {
    counters[targetKey] += 1;
    if (existedInSource) counters[oppositeKey] = Math.max(0, counters[oppositeKey] - 1);
  }

  const nextMeta = {
    atualizado: todayStamp(),
    thumb_up: counters.thumb_up,
    thumb_down: counters.thumb_down,
    ignore_tags: Array.isArray(meta.ignore_tags) ? meta.ignore_tags : [],
    // preserva quaisquer outras chaves nao-reservadas
    ...Object.fromEntries(Object.entries(meta).filter(([k]) => !['atualizado', 'thumb_up', 'thumb_down', 'ignore_tags'].includes(k))),
  };

  // Garante que a secao "Tags a ignorar" exista como comentario humano.
  if (!findSection(sections, 'Tags a ignorar')) {
    sections.push({ name: 'Tags a ignorar', lines: ['(edite `ignore_tags` no frontmatter — tags aqui sao penalizadas pelo ranker)'] });
  }

  const nextBody = serializeSections(sections);
  const text = serializeFm(nextMeta, nextBody) + '\n';
  await fs.writeFile(filePath, text, 'utf8');

  return {
    meta: {
      atualizado: nextMeta.atualizado,
      thumb_up: nextMeta.thumb_up,
      thumb_down: nextMeta.thumb_down,
      ignore_tags: nextMeta.ignore_tags,
    },
    moved: existedInSource && !alreadyInTarget,
    added: !alreadyInTarget && !existedInSource,
    noop: alreadyInTarget,
  };
}
