// lib/perfil-vibecoder-writer.mjs
//
// Escreve {vault}/Tino/_perfil-vibecoder.md a partir de frontmatter validado + body sections.
// Valida via JSON Schema da Onda 0 antes de escrever.

import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as yamlStringify } from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '..', 'config/schemas/perfil-vibecoder.schema.json');
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

let validator;
function getValidator() {
  if (validator) return validator;
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  validator = ajv.compile(SCHEMA);
  return validator;
}

export function validate(frontmatter) {
  const v = getValidator();
  if (v(frontmatter)) return [];
  return v.errors.map((e) => `${e.instancePath || '/'} ${e.message} (${e.keyword})`);
}

export async function write(vaultPath, frontmatter, body = {}) {
  const errs = validate(frontmatter);
  if (errs.length > 0) {
    throw new Error(`perfil-vibecoder invalido: ${errs.join('; ')}`);
  }

  const now = new Date().toISOString();
  const fm = {
    ...frontmatter,
    created_at: frontmatter.created_at || now,
    updated_at: now,
  };

  const fmYaml = yamlStringify(fm).trim();
  const bodyText = renderBody(body);
  const content = `---\n${fmYaml}\n---\n\n${bodyText}`;

  const dir = path.join(vaultPath, 'Tino');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, '_perfil-vibecoder.md');

  // Backup if exists
  try {
    await fs.access(filePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(filePath, `${filePath}.tino-bak.${stamp}`);
  } catch {
    // não existe — sem backup
  }

  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

function renderBody(body) {
  return [
    '## O que mais importa pra você agora\n',
    `${body.importante || '(preencha aqui)'}\n`,
    '## O que você quer evitar\n',
    `${body.evitar || '(preencha aqui)'}\n`,
    '## Notas do Tino\n',
    `${body.notas || ''}\n`,
  ].join('\n');
}
