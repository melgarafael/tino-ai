// lib/aitmpl-client.mjs
//
// Cliente do catálogo aitmpl.com.
// Endpoint real: GET https://aitmpl.com/components.json
// Schema descoberto via spike: docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md
//
// Wave 2 (F1-S02): `fetchCatalog` implementado com cache + stale-while-error.
// As demais funções permanecem como stubs até Wave 3.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DEFAULT_BASE_URL = 'https://aitmpl.com';
export const DEFAULT_CACHE_DIR = '.tino-cache/aitmpl';
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const KNOWN_KINDS = [
  'agents',
  'commands',
  'mcps',
  'settings',
  'hooks',
  'sandbox',
  'skills',
  'templates',
  'plugins',
];

export class AitmplUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'AitmplUnavailableError';
    if (cause) this.cause = cause;
  }
}

export class AitmplSchemaError extends Error {
  constructor(message, sample = '') {
    super(message);
    this.name = 'AitmplSchemaError';
    this.sample = sample;
  }
}

function resolveTtlMs(opts) {
  if (typeof opts.ttlMs === 'number' && Number.isFinite(opts.ttlMs)) return opts.ttlMs;
  const env = process.env.TINO_AITMPL_TTL;
  if (env && !Number.isNaN(Number(env))) return Number(env) * 1000;
  return DEFAULT_TTL_MS;
}

function deriveSource(baseUrl) {
  try {
    return new URL(baseUrl).hostname || baseUrl;
  } catch {
    return baseUrl;
  }
}

function validateShape(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AitmplSchemaError(
      'aitmpl response is not a JSON object',
      JSON.stringify(body).slice(0, 500),
    );
  }
  const hasKnown = KNOWN_KINDS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
  if (!hasKnown) {
    throw new AitmplSchemaError(
      `aitmpl response missing known kinds (expected one of: ${KNOWN_KINDS.join(', ')})`,
      JSON.stringify(body).slice(0, 500),
    );
  }
}

function sliceItems(body, kinds) {
  const wanted = (kinds && kinds.length) ? kinds : KNOWN_KINDS;
  const items = {};
  for (const k of wanted) {
    items[k] = Array.isArray(body[k]) ? body[k] : [];
  }
  return items;
}

async function readCache(cacheDir) {
  const dataPath = path.join(cacheDir, 'components.json');
  const metaPath = path.join(cacheDir, 'components.meta.json');
  try {
    const [raw, metaRaw] = await Promise.all([
      fs.readFile(dataPath, 'utf8'),
      fs.readFile(metaPath, 'utf8'),
    ]);
    const body = JSON.parse(raw);
    const meta = JSON.parse(metaRaw);
    return { body, meta };
  } catch {
    return null;
  }
}

async function writeCache(cacheDir, body) {
  await fs.mkdir(cacheDir, { recursive: true });
  const dataPath = path.join(cacheDir, 'components.json');
  const metaPath = path.join(cacheDir, 'components.meta.json');
  const fetchedAtMs = Date.now();
  await fs.writeFile(dataPath, JSON.stringify(body), 'utf8');
  await fs.writeFile(metaPath, JSON.stringify({ fetched_at: fetchedAtMs }), 'utf8');
  return fetchedAtMs;
}

export async function fetchCatalog(opts = {}) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const ttlMs = resolveTtlMs(opts);
  const force = !!opts.force;
  const kinds = Array.isArray(opts.kinds) ? opts.kinds : null;

  const cached = await readCache(cacheDir);

  // 1. Fresh cache hit (and not forced) — return without hitting network.
  if (!force && cached && typeof cached.meta?.fetched_at === 'number') {
    const age = Date.now() - cached.meta.fetched_at;
    if (age < ttlMs) {
      return {
        fetched_at: new Date(cached.meta.fetched_at).toISOString(),
        source: deriveSource(baseUrl),
        items: sliceItems(cached.body, kinds),
      };
    }
  }

  // 2. Try network.
  let body;
  let networkError;
  try {
    const res = await fetch(`${baseUrl}/components.json`);
    if (!res.ok) {
      throw new Error(`aitmpl: HTTP ${res.status}`);
    }
    body = await res.json();
    validateShape(body);
  } catch (err) {
    if (err instanceof AitmplSchemaError) throw err;
    networkError = err;
  }

  if (networkError) {
    // 3a. Stale cache fallback.
    if (cached) {
      console.warn('[aitmpl-client] network fail, returning stale cache');
      return {
        fetched_at: new Date(cached.meta.fetched_at).toISOString(),
        source: deriveSource(baseUrl),
        items: sliceItems(cached.body, kinds),
      };
    }
    // 3b. No cache — surface as unavailable.
    throw new AitmplUnavailableError(
      `aitmpl unavailable: ${networkError.message}`,
      { cause: networkError },
    );
  }

  // 4. Persist + return.
  const fetchedAtMs = await writeCache(cacheDir, body);
  return {
    fetched_at: new Date(fetchedAtMs).toISOString(),
    source: deriveSource(baseUrl),
    items: sliceItems(body, kinds),
  };
}

export async function fetchItem(kind, name, opts = {}) {
  if (!KNOWN_KINDS.includes(kind)) return null;
  const cat = await fetchCatalog({ ...opts, kinds: [kind] });
  const list = cat.items?.[kind];
  if (!Array.isArray(list)) return null;
  return list.find((x) => x && x.name === name) ?? null;
}

export async function search(query, opts = {}) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [];
  const limit = typeof opts.limit === 'number' && Number.isFinite(opts.limit) ? opts.limit : 20;
  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : KNOWN_KINDS;
  const cat = await fetchCatalog({ ...opts, kinds });
  const matches = [];
  for (const k of kinds) {
    const list = cat.items?.[k];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item) continue;
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      if (name.includes(q) || desc.includes(q)) {
        matches.push(item);
        if (matches.length >= limit) return matches;
      }
    }
  }
  return matches.slice(0, limit);
}

export async function invalidateCache(kind = null, opts = {}) {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const dataPath = path.join(cacheDir, 'components.json');
  const metaPath = path.join(cacheDir, 'components.meta.json');
  await Promise.all([
    fs.unlink(dataPath).catch(() => {}),
    fs.unlink(metaPath).catch(() => {}),
  ]);
  if (kind != null) {
    console.warn('[aitmpl-client] cache is single-file (components.json); kind-specific invalidation not supported, full cache cleared');
  }
}
