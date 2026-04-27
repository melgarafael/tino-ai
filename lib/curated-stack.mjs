// lib/curated-stack.mjs
//
// Parser + validator do config/curated-stack.yaml.
// Funcoes puras, sem deps externas alem de `yaml` (ja em package.json).

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const VALID_KINDS = ['skill', 'agent', 'command', 'hook', 'mcp', 'plugin'];
const VALID_SOURCES = ['curated', 'aitmpl', 'repo'];
const REQUIRED_ITEM_FIELDS = ['name', 'kind', 'install', 'why', 'source'];

export function parse(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const obj = parseYaml(raw);
  if (!obj || typeof obj !== 'object') {
    throw new Error(`curated-stack: YAML invalido em ${filePath}`);
  }
  return obj;
}

/**
 * Valida o objeto parseado e retorna lista de erros (vazia se OK).
 */
export function validate(obj) {
  const errs = [];

  if (obj?.schema_version !== 1) {
    errs.push(`schema_version deve ser 1, veio ${obj?.schema_version}`);
  }
  if (!Array.isArray(obj?.maintainers) || obj.maintainers.length === 0) {
    errs.push('maintainers deve ser array nao-vazio');
  }

  // colectar todos os items por secao + flat
  const sections = collectSections(obj);
  const allItemNames = new Set();

  for (const { sectionName, items } of sections) {
    const seenNames = new Set();
    for (const item of items) {
      // Required fields
      for (const f of REQUIRED_ITEM_FIELDS) {
        if (!item || item[f] === undefined || item[f] === null || item[f] === '') {
          errs.push(`[${sectionName}] item ${item?.name || '<sem nome>'} falta campo obrigatorio: ${f}`);
        }
      }
      if (item?.kind && !VALID_KINDS.includes(item.kind)) {
        errs.push(`[${sectionName}] item ${item.name}: kind invalido "${item.kind}" (aceito: ${VALID_KINDS.join(', ')})`);
      }
      if (item?.source && !VALID_SOURCES.includes(item.source)) {
        errs.push(`[${sectionName}] item ${item.name}: source invalido "${item.source}" (aceito: ${VALID_SOURCES.join(', ')})`);
      }
      if (item?.source === 'aitmpl' && !item?.aitmpl_id) {
        errs.push(`[${sectionName}] item ${item.name}: source=aitmpl exige aitmpl_id`);
      }
      if (item?.name) {
        if (seenNames.has(item.name)) {
          errs.push(`[${sectionName}] nome duplicado: ${item.name}`);
        }
        seenNames.add(item.name);
        allItemNames.add(item.name);
      }
    }
  }

  // incompatible refs
  if (Array.isArray(obj?.incompatible)) {
    for (const inc of obj.incompatible) {
      if (!Array.isArray(inc?.items) || inc.items.length < 2) {
        errs.push(`incompatible: items deve ser array com >= 2 nomes`);
        continue;
      }
      for (const ref of inc.items) {
        if (!allItemNames.has(ref)) {
          errs.push(`incompatible: referencia nome ausente "${ref}"`);
        }
      }
    }
  }

  return errs;
}

function collectSections(obj) {
  const out = [];
  if (Array.isArray(obj?.essentials)) {
    out.push({ sectionName: 'essentials', items: obj.essentials });
  }
  if (obj?.by_role && typeof obj.by_role === 'object') {
    for (const [role, items] of Object.entries(obj.by_role)) {
      if (Array.isArray(items)) {
        out.push({ sectionName: `by_role.${role}`, items });
      }
    }
  }
  if (obj?.by_plan && typeof obj.by_plan === 'object') {
    for (const [plan, items] of Object.entries(obj.by_plan)) {
      if (Array.isArray(items)) {
        out.push({ sectionName: `by_plan.${plan}`, items });
      }
    }
  }
  return out;
}
