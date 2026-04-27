// lib/aitmpl-client.mjs
//
// Cliente do catálogo aitmpl.com.
// Endpoint real: GET https://aitmpl.com/components.json
// Schema descoberto via spike: docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md
//
// Wave 2 (F1-S02): apenas `fetchCatalog` é stub nesta fase de scaffold.
// As demais funções permanecem como stubs ate Wave 3.

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

export async function fetchCatalog(opts = {}) {
  throw new Error('fetchCatalog: not implemented yet');
}

export async function fetchItem(kind, name, opts = {}) {
  throw new Error('fetchItem: not implemented yet');
}

export async function search(query, opts = {}) {
  throw new Error('search: not implemented yet');
}

export async function invalidateCache(kind = null, opts = {}) {
  throw new Error('invalidateCache: not implemented yet');
}
