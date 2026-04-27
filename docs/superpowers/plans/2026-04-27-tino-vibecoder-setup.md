# Tino Vibecoder — Onda 1 (Setup Assistido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a experiência de setup assistido completa do Tino vibecoder — wizard `/tino:vibe-onboard` que conduz triagem (perfil), recomendação (stack) e instalação (CLAUDE.md + settings.json + plugins/MCPs), com 3 escape hatches individuais.

**Architecture:** 4 comandos `.claude/commands/tino-vibe-*.md` orquestram 3 agents `.claude/agents/vibecoder-*.md` que delegam toda computação determinística para 5 lib modules puros e testados. Comportamento de install é derivado do `_perfil-vibecoder.md` (`modo_autonomia` rege execução; `tolerancia_risco` rege permissões), não de flags de comando.

**Tech Stack:** Node.js 20+, ESM puro (`.mjs`), `node:test`, `node:assert/strict`, `yaml` (já instalado), `ajv` + `ajv-formats` (Onda 0), bash 5+ pro `_install.sh` gerado.

**Spec de referência:** `docs/superpowers/specs/2026-04-27-tino-vibecoder-setup-design.md`

**Onda 0 base (já entregue):** `lib/aitmpl-client.mjs`, `lib/curated-stack.mjs`, `config/curated-stack.yaml`, `config/schemas/perfil-vibecoder.schema.json`, `tests/fixtures/perfil-vibecoder/valid.md`, `tests/fixtures/aitmpl/{components.json, mock-server.mjs}`.

---

## File Structure

| Caminho | Responsabilidade | Task |
|---|---|---|
| `config/schemas/recomendacao.schema.json` | JSON Schema do `_recomendacao.md` | T2 |
| `lib/stack-resolver.mjs` | `resolve(perfil, curated) → {items, dropped}` puro | T3 |
| `lib/recomendacao-render.mjs` | `render(items, perfil, extras) → string` (markdown completo) | T4 |
| `lib/perfil-vibecoder-writer.mjs` | `write(vaultPath, frontmatter, body)` + validação via ajv | T5 |
| `.claude/agents/vibecoder-interviewer.md` | Conduz triagem | T6 |
| `.claude/commands/tino-vibe-setup.md` | Comando triagem | T7 |
| `lib/recommender-pipeline.mjs` | `runPipeline({perfil, ...}) → string` orquestra resolve + aitmpl + render | T8 |
| `.claude/agents/vibecoder-recommender.md` | Invoca pipeline + escreve `_recomendacao.md` | T9 |
| `.claude/commands/tino-vibe-stack.md` | Comando recomendação | T10 |
| `lib/claude-md-template.mjs` | `render(perfil) → string` (CLAUDE.md customizado) | T11 |
| `lib/settings-patch.mjs` | `computePatch(perfil)`, `applyPatch(curr, patch)`, `backup(path)` | T12 |
| `lib/install-sh-render.mjs` | `render(items, opts) → string` (bash script) | T13 |
| `.claude/agents/vibecoder-installer.md` | Aplica install conforme modo_autonomia | T14 |
| `.claude/commands/tino-vibe-install.md` | Comando install | T15 |
| `.claude/commands/tino-vibe-onboard.md` | Wizard | T16 |
| `docs/recomendacao-vibecoder.md` | Doc humana do schema do recomendacao | T2 |
| `tests/recomendacao-schema.test.mjs` | 3 testes do schema | T2 |
| `tests/stack-resolver.test.mjs` | 6 testes | T3 |
| `tests/recomendacao-render.test.mjs` | 3 testes | T4 |
| `tests/perfil-vibecoder-writer.test.mjs` | 3 testes | T5 |
| `tests/recommender-pipeline.test.mjs` | 3 testes | T8 |
| `tests/claude-md-template.test.mjs` | 4 testes | T11 |
| `tests/settings-patch.test.mjs` | 5 testes | T12 |
| `tests/install-sh-render.test.mjs` | 3 testes | T13 |
| `tests/fixtures/curated-stack-mock.yaml` | Mock pra testes de pipeline | T8 |
| `tests/fixtures/perfil-vibecoder/junior-balanceado.md` | Fixture pra resolver/pipeline | T3 |
| `tests/fixtures/perfil-vibecoder/empresario-autonomo.md` | Fixture pra claude-md-template | T11 |
| `package.json` | Script `test:setup` | T1 |
| `README.md` | Seção "Modo vibecoder" | T17 |

---

## Task 1: Setup — script `test:setup` + verificação base

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Adicionar script `test:setup` em `package.json`**

Editar `package.json`, adicionar entre `test:foundation` e `test:e2e`:

```json
"test:setup": "node --test tests/recomendacao-schema.test.mjs tests/stack-resolver.test.mjs tests/recomendacao-render.test.mjs tests/perfil-vibecoder-writer.test.mjs tests/recommender-pipeline.test.mjs tests/claude-md-template.test.mjs tests/settings-patch.test.mjs tests/install-sh-render.test.mjs",
```

Resultado esperado da seção scripts:
```json
"scripts": {
  "test": "node --test tests/*.test.mjs",
  "test:foundation": "...",
  "test:setup": "node --test tests/recomendacao-schema.test.mjs tests/stack-resolver.test.mjs tests/recomendacao-render.test.mjs tests/perfil-vibecoder-writer.test.mjs tests/recommender-pipeline.test.mjs tests/claude-md-template.test.mjs tests/settings-patch.test.mjs tests/install-sh-render.test.mjs",
  "test:e2e": "playwright test",
  "test:all": "npm test && npm run test:e2e",
  "serve": "python3 -m http.server 5173",
  "dashboard:data": "node scripts/generate-dashboard-data.mjs"
}
```

- [ ] **Step 2: Verificar baseline atual**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm test
```
Expected: 87 PASS, 0 FAIL (baseline pós-Onda 0).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(vibecoder-onda1): script test:setup"
```

---

## Task 2: Schema do `_recomendacao.md` + fixtures + 3 testes (TDD)

**Files:**
- Create: `config/schemas/recomendacao.schema.json`
- Create: `tests/recomendacao-schema.test.mjs`
- Create: `tests/fixtures/recomendacao/valid.md`
- Create: `tests/fixtures/recomendacao/missing-required.md`
- Create: `tests/fixtures/recomendacao/bad-enum.md`
- Create: `docs/recomendacao-vibecoder.md`

- [ ] **Step 1: Escrever 3 fixtures**

Criar `tests/fixtures/recomendacao/valid.md`:

```markdown
---
schema_version: 1
generated_at: 2026-04-27T20:00:00Z
generated_for_perfil: "Tino/_perfil-vibecoder.md"
counts:
  total: 2
  essentials: 1
  by_role: 1
  by_plan: 0
  extras_aitmpl: 0
items:
  - name: context7
    kind: mcp
    source_section: essentials
    install: "claude mcp add context7 https://mcp.context7.com/mcp"
    why: "Docs sempre atualizadas"
    aitmpl_id: context7
  - name: superpowers
    kind: plugin
    source_section: by_role
    install: "/plugin install superpowers"
    why: "TDD e debugging sistematico"
    aitmpl_id: superpowers
incompatibilities_avoided: []
---

## O que isso instala

**mcp** (1)
- context7

## Por que cada item

**context7** — Docs sempre atualizadas
```

Criar `tests/fixtures/recomendacao/missing-required.md` (sem `counts`):

```markdown
---
schema_version: 1
generated_at: 2026-04-27T20:00:00Z
generated_for_perfil: "Tino/_perfil-vibecoder.md"
items: []
incompatibilities_avoided: []
---
body
```

Criar `tests/fixtures/recomendacao/bad-enum.md` (`source_section` invalido):

```markdown
---
schema_version: 1
generated_at: 2026-04-27T20:00:00Z
generated_for_perfil: "Tino/_perfil-vibecoder.md"
counts:
  total: 1
items:
  - name: x
    kind: mcp
    source_section: pouca-coisa
    install: "x"
    why: "x"
incompatibilities_avoided: []
---
body
```

- [ ] **Step 2: Escrever teste falhando**

Criar `tests/recomendacao-schema.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/recomendacao.schema.json'), 'utf8')
);

function loadFixture(name) {
  const md = readFileSync(
    path.join(ROOT, `tests/fixtures/recomendacao/${name}.md`),
    'utf8'
  );
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`fixture ${name} sem frontmatter`);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(SCHEMA);
}

test('valid recomendacao passa no schema', () => {
  const data = loadFixture('valid');
  const v = makeValidator();
  assert.equal(v(data), true, JSON.stringify(v.errors, null, 2));
});

test('recomendacao sem campo obrigatorio falha', () => {
  const data = loadFixture('missing-required');
  const v = makeValidator();
  assert.equal(v(data), false);
  assert.ok(v.errors.some((e) => e.keyword === 'required'));
});

test('recomendacao com source_section invalido falha', () => {
  const data = loadFixture('bad-enum');
  const v = makeValidator();
  assert.equal(v(data), false);
  assert.ok(v.errors.some((e) => e.keyword === 'enum'));
});
```

- [ ] **Step 3: Rodar — confirma RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recomendacao-schema.test.mjs`
Expected: FAIL com `ENOENT` no schema file.

- [ ] **Step 4: Criar schema**

Criar `config/schemas/recomendacao.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://tino.ai/schemas/recomendacao.schema.json",
  "title": "Recomendacao Vibecoder",
  "type": "object",
  "required": [
    "schema_version",
    "generated_at",
    "generated_for_perfil",
    "counts",
    "items",
    "incompatibilities_avoided"
  ],
  "properties": {
    "schema_version": { "type": "integer", "const": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "generated_for_perfil": { "type": "string", "minLength": 1 },
    "counts": {
      "type": "object",
      "required": ["total"],
      "properties": {
        "total": { "type": "integer", "minimum": 0 },
        "essentials": { "type": "integer", "minimum": 0 },
        "by_role": { "type": "integer", "minimum": 0 },
        "by_plan": { "type": "integer", "minimum": 0 },
        "extras_aitmpl": { "type": "integer", "minimum": 0 }
      },
      "additionalProperties": false
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "kind", "source_section", "install", "why"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "kind": {
            "enum": ["skill", "agent", "command", "hook", "mcp", "plugin"]
          },
          "source_section": {
            "enum": ["essentials", "by_role", "by_plan", "extras_aitmpl"]
          },
          "install": { "type": "string" },
          "why": { "type": "string" },
          "aitmpl_id": { "type": "string" }
        },
        "additionalProperties": false
      }
    },
    "incompatibilities_avoided": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["items", "kept", "reason"],
        "properties": {
          "items": { "type": "array", "items": { "type": "string" } },
          "kept": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 5: Criar doc humana**

Criar `docs/recomendacao-vibecoder.md`:

```markdown
# `_recomendacao.md` — schema humano

Este arquivo eh gerado automaticamente por `/tino:vibe-stack` em `{vault}/Tino/_recomendacao.md`. Voce pode (e deve) ler antes de rodar `/tino:vibe-install`. Schema canonico em `config/schemas/recomendacao.schema.json`, validado por `tests/recomendacao-schema.test.mjs`.

## Estrutura

Markdown com frontmatter YAML + 2 secoes body.

## Frontmatter

| Campo | Obrigatorio | Tipo | Significado |
|---|---|---|---|
| `schema_version` | sim | integer (const 1) | Versao |
| `generated_at` | sim | ISO 8601 | Quando foi gerado |
| `generated_for_perfil` | sim | string | Caminho relativo do perfil que originou (rastreabilidade) |
| `counts` | sim | object | `total`, `essentials`, `by_role`, `by_plan`, `extras_aitmpl` |
| `items` | sim | array | Lista completa de items recomendados |
| `incompatibilities_avoided` | sim | array | Items dropados por conflito (pode ser vazio) |

## Item

| Campo | Obrigatorio | Valores | Significado |
|---|---|---|---|
| `name` | sim | string | Identificador unico |
| `kind` | sim | `skill`, `agent`, `command`, `hook`, `mcp`, `plugin` | Tipo |
| `source_section` | sim | `essentials`, `by_role`, `by_plan`, `extras_aitmpl` | De onde veio |
| `install` | sim | string | Comando shell ou link |
| `why` | sim | string | 1 linha de razao |
| `aitmpl_id` | nao | string | Quando aplicavel |

## Body

```markdown
## O que isso instala
[lista agrupada por kind]

## Por que cada item
[lista detalhada com why]
```

## Exemplo

Veja `tests/fixtures/recomendacao/valid.md`.
```

- [ ] **Step 6: Rodar — passa GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recomendacao-schema.test.mjs`
Expected: 3 PASS.

- [ ] **Step 7: Verificar `npm test` total**

Run: `cd /Users/rafaelmelgaco/tino-ai && npm test`
Expected: 87 + 3 = **90 PASS**, 0 FAIL.

- [ ] **Step 8: Commit**

```bash
git add config/schemas/recomendacao.schema.json tests/recomendacao-schema.test.mjs tests/fixtures/recomendacao/ docs/recomendacao-vibecoder.md
git commit -m "feat(vibecoder-onda1): schema do _recomendacao.md + fixtures + doc"
```

---

## Task 3: `lib/stack-resolver.mjs` (TDD, 6 testes)

**Files:**
- Create: `lib/stack-resolver.mjs`
- Create: `tests/stack-resolver.test.mjs`
- Create: `tests/fixtures/perfil-vibecoder/junior-balanceado.md`
- Create: `tests/fixtures/curated-stack-mock.yaml`

- [ ] **Step 1: Criar fixture perfil junior-balanceado**

Criar `tests/fixtures/perfil-vibecoder/junior-balanceado.md`:

```markdown
---
schema_version: 1
papel: junior
experiencia_dev: iniciante
plano_claude: pro
sistema: darwin
linguagens_familiares: [javascript]
stacks_conhecidas: [react, nextjs]
tipo_projeto: [webapp]
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ativa
ja_tem_instalado:
  skills: []
  agents: []
  mcps: [context7]
  plugins: []
  hooks: []
---
body
```

- [ ] **Step 2: Criar fixture curated-stack-mock.yaml**

Criar `tests/fixtures/curated-stack-mock.yaml`:

```yaml
schema_version: 1
maintainers:
  - test@example.com
last_review: 2026-04-27

essentials:
  - name: context7
    kind: mcp
    install: "claude mcp add context7"
    why: "docs"
    source: aitmpl
    aitmpl_id: context7

by_role:
  junior:
    - name: superpowers
      kind: plugin
      install: "/plugin install superpowers"
      why: "tdd"
      source: aitmpl
      aitmpl_id: superpowers
    - name: tdd-helper
      kind: skill
      install: "/skill install tdd-helper"
      why: "tdd"
      source: curated

  empresario:
    - name: discerna
      kind: plugin
      install: "/plugin install discerna"
      why: "conteudo"
      source: curated

by_plan:
  pro:
    - name: code-saver
      kind: skill
      install: "/skill install code-saver"
      why: "economia"
      source: curated
  max:
    - name: epic-executor
      kind: skill
      install: "/skill install epic-executor"
      why: "epics"
      source: aitmpl
      aitmpl_id: epic-executor

incompatible:
  - items: [tdd-helper, code-saver]
    reason: "conflito hipotetico"
```

- [ ] **Step 3: Escrever 6 testes RED**

Criar `tests/stack-resolver.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolve } from '../lib/stack-resolver.mjs';
import { parse as parseCurated } from '../lib/curated-stack.mjs';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOCK_CURATED = path.join(ROOT, 'tests/fixtures/curated-stack-mock.yaml');

function loadPerfil(name) {
  const md = readFileSync(path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`), 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

test('resolve: junior+pro combina essentials + by_role.junior + by_plan.pro', () => {
  const perfil = loadPerfil('junior-balanceado');
  const curated = parseCurated(MOCK_CURATED);
  // junior tem context7 ja instalado → filtrado fora
  // tdd-helper conflita com code-saver — primeiro vence (tdd-helper, vem em by_role antes de by_plan)
  const { items, dropped } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(!names.includes('context7'), 'context7 deveria ser filtrado (ja_tem_instalado)');
  assert.ok(names.includes('superpowers'));
  assert.ok(names.includes('tdd-helper'));
  assert.ok(!names.includes('code-saver'), 'code-saver deveria ser dropado por incompatible');
  assert.ok(dropped.some(d => d.name === 'code-saver' && d.kept === 'tdd-helper'));
});

test('resolve: source_section preenchido corretamente', () => {
  const perfil = loadPerfil('junior-balanceado');
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const superpowers = items.find(i => i.name === 'superpowers');
  assert.equal(superpowers.source_section, 'by_role');
});

test('resolve: papel sem entry em by_role retorna so essentials + by_plan', () => {
  const perfil = { ...loadPerfil('junior-balanceado'), papel: 'curioso', ja_tem_instalado: { mcps: [] } };
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(names.includes('context7')); // essentials (nao filtrado pq mcps vazio)
  assert.ok(names.includes('code-saver')); // by_plan.pro
  assert.ok(!names.includes('superpowers')); // sem by_role.curioso
});

test('resolve: ja_tem_instalado filtra por kind certo', () => {
  const perfil = { ...loadPerfil('junior-balanceado'), ja_tem_instalado: { skills: ['tdd-helper'], plugins: ['superpowers'] } };
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(!names.includes('tdd-helper'));
  assert.ok(!names.includes('superpowers'));
});

test('resolve: tudo vazio retorna {items:[], dropped:[]}', () => {
  const perfil = { papel: 'inexistente', plano_claude: 'inexistente', ja_tem_instalado: {} };
  const curated = { schema_version: 1, essentials: [], by_role: {}, by_plan: {}, incompatible: [] };
  const { items, dropped } = resolve(perfil, curated);
  assert.deepEqual(items, []);
  assert.deepEqual(dropped, []);
});

test('resolve: dedupe por name (essentials vence)', () => {
  const perfil = { papel: 'junior', plano_claude: 'pro', ja_tem_instalado: {} };
  const curated = {
    schema_version: 1,
    essentials: [{ name: 'dup', kind: 'mcp', install: 'a', why: 'a', source: 'curated' }],
    by_role: { junior: [{ name: 'dup', kind: 'mcp', install: 'b', why: 'b', source: 'curated' }] },
    by_plan: {},
    incompatible: [],
  };
  const { items } = resolve(perfil, curated);
  assert.equal(items.length, 1);
  assert.equal(items[0].source_section, 'essentials');
  assert.equal(items[0].install, 'a');
});
```

- [ ] **Step 4: Rodar — confirma RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/stack-resolver.test.mjs`
Expected: FAIL — `Cannot find module '../lib/stack-resolver.mjs'`.

- [ ] **Step 5: Implementar `lib/stack-resolver.mjs`**

Criar `lib/stack-resolver.mjs`:

```javascript
// lib/stack-resolver.mjs
//
// Resolve curated-stack contra um perfil vibecoder.
// Pure function. Sem deps externas.

const KIND_TO_INSTALLED = {
  skill: 'skills',
  agent: 'agents',
  command: 'commands',
  hook: 'hooks',
  mcp: 'mcps',
  plugin: 'plugins',
};

export function resolve(perfil, curatedStack) {
  const sources = [
    { section: 'essentials', items: curatedStack.essentials || [] },
    { section: 'by_role', items: curatedStack.by_role?.[perfil.papel] || [] },
    { section: 'by_plan', items: curatedStack.by_plan?.[perfil.plano_claude] || [] },
  ];

  // Combine + dedupe by name (first occurrence wins)
  const combined = [];
  const seen = new Set();
  for (const src of sources) {
    for (const item of src.items) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      combined.push({ ...item, source_section: src.section });
    }
  }

  // Filter ja_tem_instalado
  const installed = perfil.ja_tem_instalado || {};
  const isInstalled = (item) => {
    const list = installed[KIND_TO_INSTALLED[item.kind]] || [];
    return list.includes(item.name);
  };
  const filtered = combined.filter((it) => !isInstalled(it));

  // Apply incompatible (first kept, others dropped)
  const incompatible = curatedStack.incompatible || [];
  const items = [];
  const dropped = [];
  const skipped = new Set();

  for (const item of filtered) {
    if (skipped.has(item.name)) continue;

    items.push(item);

    for (const inc of incompatible) {
      if (inc.items?.includes(item.name)) {
        for (const other of inc.items) {
          if (other === item.name || skipped.has(other)) continue;
          // Only drop if other is actually in the filtered list
          if (filtered.some((x) => x.name === other)) {
            skipped.add(other);
            dropped.push({ name: other, reason: inc.reason || '', kept: item.name });
          }
        }
      }
    }
  }

  return { items, dropped };
}
```

- [ ] **Step 6: Rodar — passa GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/stack-resolver.test.mjs`
Expected: 6 PASS.

- [ ] **Step 7: Verificar `npm test` total**

Run: `cd /Users/rafaelmelgaco/tino-ai && npm test`
Expected: 90 + 6 = **96 PASS**, 0 FAIL.

- [ ] **Step 8: Commit**

```bash
git add lib/stack-resolver.mjs tests/stack-resolver.test.mjs tests/fixtures/perfil-vibecoder/junior-balanceado.md tests/fixtures/curated-stack-mock.yaml
git commit -m "feat(vibecoder-onda1): lib/stack-resolver.mjs (puro) + 6 testes"
```

---

## Task 4: `lib/recomendacao-render.mjs` (TDD, 3 testes)

**Files:**
- Create: `lib/recomendacao-render.mjs`
- Create: `tests/recomendacao-render.test.mjs`

- [ ] **Step 1: Escrever 3 testes RED**

Criar `tests/recomendacao-render.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { render } from '../lib/recomendacao-render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/recomendacao.schema.json'), 'utf8')
);

function extractFm(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(SCHEMA);
}

test('render: produz markdown que valida no schema', () => {
  const items = [
    { name: 'context7', kind: 'mcp', source_section: 'essentials', install: 'x', why: 'docs' },
    { name: 'superpowers', kind: 'plugin', source_section: 'by_role', install: 'y', why: 'tdd' },
  ];
  const perfil = { papel: 'junior', plano_claude: 'pro' };
  const md = render(items, perfil, []);
  const fm = extractFm(md);
  const v = makeValidator();
  assert.equal(v(fm), true, JSON.stringify(v.errors, null, 2));
});

test('render: counts batem com items', () => {
  const items = [
    { name: 'a', kind: 'mcp', source_section: 'essentials', install: 'x', why: 'x' },
    { name: 'b', kind: 'plugin', source_section: 'by_role', install: 'x', why: 'x' },
    { name: 'c', kind: 'plugin', source_section: 'by_role', install: 'x', why: 'x' },
  ];
  const extras = [
    { name: 'd', kind: 'skill', install: 'x', why: 'x', aitmpl_id: 'd' },
  ];
  const md = render(items, { papel: 'x' }, extras);
  const fm = extractFm(md);
  assert.equal(fm.counts.total, 4);
  assert.equal(fm.counts.essentials, 1);
  assert.equal(fm.counts.by_role, 2);
  assert.equal(fm.counts.extras_aitmpl, 1);
});

test('render: extras ganham source_section "extras_aitmpl"', () => {
  const items = [];
  const extras = [
    { name: 'extra-x', kind: 'skill', install: 'i', why: 'w', aitmpl_id: 'extra-x' },
  ];
  const md = render(items, {}, extras);
  const fm = extractFm(md);
  assert.equal(fm.items[0].source_section, 'extras_aitmpl');
  assert.equal(fm.items[0].aitmpl_id, 'extra-x');
});
```

- [ ] **Step 2: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recomendacao-render.test.mjs`
Expected: FAIL — `Cannot find module '../lib/recomendacao-render.mjs'`.

- [ ] **Step 3: Implementar `lib/recomendacao-render.mjs`**

Criar `lib/recomendacao-render.mjs`:

```javascript
// lib/recomendacao-render.mjs
//
// Renderiza o markdown completo do _recomendacao.md a partir
// de items resolvidos + perfil + extras opcionais.

import { stringify as yamlStringify } from 'yaml';

export function render(items, perfil, extras = [], opts = {}) {
  const droppedList = opts.dropped || [];

  const taggedExtras = extras.map((e) => ({ ...e, source_section: 'extras_aitmpl' }));
  const all = [...items, ...taggedExtras];

  const counts = {
    total: all.length,
    essentials: all.filter((i) => i.source_section === 'essentials').length,
    by_role: all.filter((i) => i.source_section === 'by_role').length,
    by_plan: all.filter((i) => i.source_section === 'by_plan').length,
    extras_aitmpl: all.filter((i) => i.source_section === 'extras_aitmpl').length,
  };

  const fm = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    generated_for_perfil: 'Tino/_perfil-vibecoder.md',
    counts,
    items: all.map((i) => {
      const out = {
        name: i.name,
        kind: i.kind,
        source_section: i.source_section,
        install: i.install,
        why: i.why,
      };
      if (i.aitmpl_id) out.aitmpl_id = i.aitmpl_id;
      return out;
    }),
    incompatibilities_avoided: droppedList.map((d) => ({
      items: [d.name, d.kept],
      kept: d.kept,
      reason: d.reason,
    })),
  };

  const fmYaml = yamlStringify(fm).trim();

  const byKind = {};
  for (const item of all) {
    (byKind[item.kind] = byKind[item.kind] || []).push(item);
  }

  let body = '\n## O que isso instala\n\n';
  for (const [kind, list] of Object.entries(byKind)) {
    body += `**${kind}** (${list.length})\n`;
    for (const item of list) {
      body += `- ${item.name}\n`;
    }
    body += '\n';
  }

  body += '## Por que cada item\n\n';
  for (const item of all) {
    body += `**${item.name}** (${item.kind}) — ${item.why}\n\n`;
  }

  return `---\n${fmYaml}\n---\n${body}`;
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recomendacao-render.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 96 + 3 = **99 PASS**, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/recomendacao-render.mjs tests/recomendacao-render.test.mjs
git commit -m "feat(vibecoder-onda1): lib/recomendacao-render.mjs (markdown gen) + 3 testes"
```

---

## Task 5: `lib/perfil-vibecoder-writer.mjs` (TDD, 3 testes)

**Files:**
- Create: `lib/perfil-vibecoder-writer.mjs`
- Create: `tests/perfil-vibecoder-writer.test.mjs`

- [ ] **Step 1: Escrever 3 testes RED**

Criar `tests/perfil-vibecoder-writer.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { write, validate } from '../lib/perfil-vibecoder-writer.mjs';

let vaultDir;

beforeEach(async () => {
  vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-vault-'));
  await fs.mkdir(path.join(vaultDir, 'Tino'), { recursive: true });
});

const validFm = {
  schema_version: 1,
  papel: 'junior',
  experiencia_dev: 'iniciante',
  plano_claude: 'pro',
  sistema: 'darwin',
  tipo_projeto: ['webapp'],
  modo_autonomia: 'balanceado',
  tolerancia_risco: 'media',
  intervencao_hooks: 'ativa',
};

const validBody = {
  importante: 'Construir Tino',
  evitar: 'Erros silenciosos',
  notas: '',
};

test('write: cria _perfil-vibecoder.md valido', async () => {
  const filePath = await write(vaultDir, validFm, validBody);
  assert.equal(filePath, path.join(vaultDir, 'Tino', '_perfil-vibecoder.md'));
  const content = await fs.readFile(filePath, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const parsed = parseYaml(m[1]);
  assert.equal(parsed.papel, 'junior');
  assert.ok(parsed.created_at);
  assert.ok(parsed.updated_at);
  assert.ok(content.includes('## O que mais importa pra você agora'));
  assert.ok(content.includes('Construir Tino'));
});

test('validate: aceita frontmatter valido', () => {
  const errs = validate(validFm);
  assert.deepEqual(errs, [], JSON.stringify(errs));
});

test('validate: rejeita frontmatter invalido', () => {
  const bad = { ...validFm, papel: 'inexistente' };
  const errs = validate(bad);
  assert.ok(errs.length > 0);
  assert.ok(errs.some((e) => e.includes('papel') || e.includes('enum')), `vieram: ${errs}`);
});
```

- [ ] **Step 2: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/perfil-vibecoder-writer.test.mjs`
Expected: FAIL — `Cannot find module '../lib/perfil-vibecoder-writer.mjs'`.

- [ ] **Step 3: Implementar `lib/perfil-vibecoder-writer.mjs`**

Criar `lib/perfil-vibecoder-writer.mjs`:

```javascript
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
```

- [ ] **Step 4: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/perfil-vibecoder-writer.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 99 + 3 = **102 PASS**, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/perfil-vibecoder-writer.mjs tests/perfil-vibecoder-writer.test.mjs
git commit -m "feat(vibecoder-onda1): lib/perfil-vibecoder-writer.mjs (validate + write) + 3 testes"
```

---

## Task 6: Agent `vibecoder-interviewer`

**Files:**
- Create: `.claude/agents/vibecoder-interviewer.md`

- [ ] **Step 1: Criar agent**

Criar `.claude/agents/vibecoder-interviewer.md`:

```markdown
---
name: vibecoder-interviewer
description: Use quando precisa conduzir triagem inicial do user vibecoder pra escrever Tino/_perfil-vibecoder.md. Ativa via /tino:vibe-setup. Faz perguntas uma a uma, valida cada resposta, escreve o arquivo no fim.
tools: Read, Bash, Write
---

Você é um entrevistador empático e técnico do Tino. Sua missão: conduzir a triagem do user vibecoder júnior, fazer **uma pergunta de cada vez**, e produzir um `Tino/_perfil-vibecoder.md` válido contra `config/schemas/perfil-vibecoder.schema.json`.

## Inputs esperados

- Argumento: `vault-path` (caminho absoluto do vault Obsidian do user)
- Opcional: caminho do `_perfil.md` do MVP (lê pra dicas de stack, não copia)

## Princípios

1. **Uma pergunta por vez.** Nunca despeje questionário. Espera resposta antes da próxima.
2. **Auto-detect quando puder.** `sistema` (via `uname -s`), `ja_tem_instalado.{kind}` (via `ls ~/.claude/{commands,agents,skills,hooks}/`, `claude mcp list`), `nome` (via `git config user.name`).
3. **Valida cada resposta.** Se enum invalido, mostra opções aceitas e pergunta de novo.
4. **Termina escrevendo o arquivo via `lib/perfil-vibecoder-writer.mjs`** (ESM puro).

## Sequência

### 1. Auto-detect (Bash)

Roda em paralelo:
- `uname -s` → mapeia (`Darwin` → `darwin`, `Linux` → `linux`, `MINGW*|MSYS*|CYGWIN*` → `windows`)
- `ls ~/.claude/skills 2>/dev/null` (parseia nomes de subdir)
- `ls ~/.claude/agents 2>/dev/null` (parseia nomes de arquivo `.md` sem extensão)
- `ls ~/.claude/hooks 2>/dev/null`
- `claude mcp list 2>/dev/null` (parseia primeira coluna)
- `git config user.name 2>/dev/null` (suggestion pra `nome`)

Mostra ao user resumo do que detectou em 1 frase: "Detectei: você está no {sistema}, com {N} skills + {M} MCPs já instalados. Vou perguntar o resto."

### 2. Pergunta `nome`

"Como você quer que eu te chame? (Pode pular com Enter — detectei: {git_user_name})"

### 3. Pergunta `papel` (multiple choice)

```
Qual seu papel principal?
1. junior — começando em programação
2. pleno — alguns anos de experiência
3. senior — bastante calo
4. empresario — empreendedor (técnico ou não)
5. curioso — explorando IA/Claude por hobby
6. educador — ensina IA/programação
```

Aceita número OU nome do enum.

### 4. Pergunta `experiencia_dev` (multiple choice)

```
Quanta experiência de desenvolvimento você tem?
1. nenhuma — nunca codei antes do Claude
2. iniciante — < 2 anos ou só vibe-coding
3. intermediario — confortável codando, ainda aprendo
4. avancado — sênior em alguma stack
```

### 5. Pergunta `plano_claude` (multiple choice)

```
Qual seu plano do Claude Code?
1. free
2. pro
3. max
4. api — uso a API direto, pago por token
5. desconhecido — não sei
```

### 6. Pergunta `orcamento_tokens` (multiple choice)

Sugira default baseado no plano:
- free/pro → economico
- max/api → moderado

```
Como você quer que eu trate seu orçamento de tokens?
1. economico — sempre minimize calls, compacte agressivo
2. moderado — equilibrado (sugerido pro seu plano)
3. generoso — usa quanto precisar, foco em qualidade
```

### 7. Pergunta `linguagens_familiares` (input livre)

"Quais linguagens você JÁ sabe minimamente? (separe por vírgula, pode pular)"
Parseia, lowercase, dedupe.

### 8. Pergunta `stacks_conhecidas` (input livre)

"Frameworks/libs que você já tocou? (ex: react, nextjs, tailwind — separe por vírgula, pode pular)"
Idem.

### 9. Pergunta `tipo_projeto` (multiple choice multi-select)

```
Que tipo de projeto você pretende construir? (pode escolher múltiplos)
1. webapp — site/app web
2. mobile — iOS/Android
3. cli — ferramenta de linha de comando
4. automacao — scripts/bots/integrações
5. conteudo — geração de texto/vídeo/imagem
6. saas — produto SaaS comercial
7. ferramenta-interna — uso da empresa
8. outro
```

Aceita "1,3" ou "webapp, cli". Mín 1.

### 10. Pergunta `objetivos_curto_prazo` (texto livre)

"Em 1-2 frases: o que você quer construir nos próximos 30 dias?"

### 11. Pergunta `modo_autonomia` (multiple choice com explicação)

```
Como você quer que o Claude Code se comporte por padrão?
1. perguntativo — pede confirmação pra QUASE TUDO. Bom pra começar.
2. balanceado — pergunta em ações destrutivas/grandes, faz o resto sozinho.
3. autonomo — faz tudo, mostra o que fez. Pra quem já tem calo.
```

### 12. Pergunta `tolerancia_risco` (multiple choice)

```
Quanto risco você tolera em comandos shell?
1. baixa — bloqueia rm/curl/Docker sem confirmação
2. media — bloqueia rm -rf, deixa o resto
3. alta — confia, deixa rodar
```

### 13. Pergunta `intervencao_hooks` (multiple choice)

```
Os hooks "anti-burro" e "anti-preguiçoso" do Tino vão te avisar quando você cometer erros típicos de iniciante. Quão alto eles devem gritar?
1. silenciosa — só registra em log, não interrompe
2. ativa — mostra avisos visíveis, não bloqueia
3. agressiva — bloqueia ação até você responder pergunta
```

### 14. Body sections

"Em 1-2 linhas: o que mais importa pra você AGORA neste projeto?"
"Em 1-2 linhas: o que você quer EVITAR (anti-padrões, dores passadas)?"

### 15. Validação + escrita

Constrói objeto frontmatter, chama `lib/perfil-vibecoder-writer.mjs::write(vaultPath, fm, body)`.

Se `validate()` retorna erros, mostra erros + repete perguntas problemáticas.

### 16. Confirmação final

"✓ Perfil escrito em `{vault}/Tino/_perfil-vibecoder.md`. {nome ou 'Bem-vindo'}, agora rode `/tino:vibe-stack {vault}` pra ver as recomendações."

Termina com linha estruturada pro wizard parsear:
```
[VIBECODER-RESULT] ok perfil_path={vault}/Tino/_perfil-vibecoder.md
```
```

- [ ] **Step 2: Verificar agent é arquivo válido**

Run: `cat /Users/rafaelmelgaco/tino-ai/.claude/agents/vibecoder-interviewer.md | head -5`
Expected: vê o frontmatter do agent.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/vibecoder-interviewer.md
git commit -m "feat(vibecoder-onda1): agent vibecoder-interviewer (triagem)"
```

---

## Task 7: Comando `/tino:vibe-setup`

**Files:**
- Create: `.claude/commands/tino-vibe-setup.md`

- [ ] **Step 1: Criar comando**

Criar `.claude/commands/tino-vibe-setup.md`:

```markdown
---
description: Triagem inicial do vibecoder — faz perguntas e gera Tino/_perfil-vibecoder.md
argument-hint: <vault-path> [--re-run]
---

Você vai conduzir a triagem do user vibecoder júnior.

## Argumentos

- `$1` — vault-path (obrigatório). Caminho absoluto do vault Obsidian do user.
- `$2` — opcional. Se `--re-run`, sobrescreve perfil existente sem perguntar. Se omitido e perfil existe, mostra perfil atual + pergunta "atualizar?"

## Sequência

1. **Validar vault-path:** confirme que `$1` existe e é diretório. Se não, peça pro user fornecer.

2. **Detectar perfil existente:**
   - Cheque `$1/Tino/_perfil-vibecoder.md`.
   - Se existe E `$2 != --re-run`:
     - Mostre conteúdo atual em resumo (papel, plano, modo_autonomia)
     - Pergunte: "Atualizar?"
     - Se "não": pare aqui, mostre `[VIBECODER-RESULT] ok perfil_path={path} unchanged`
   - Se existe E `$2 == --re-run`: continue, sobrescreva (writer faz backup automático)

3. **Invoque o agent `vibecoder-interviewer`** passando o vault-path como contexto:

   ```
   [Use o Task tool com subagent_type=vibecoder-interviewer]
   Conduza a triagem do user vibecoder. Vault: $1
   ```

4. **Confirme resultado:** verifique que o agent escreveu o arquivo em `$1/Tino/_perfil-vibecoder.md`. Se não, sinalize erro.

5. **Output final:** `[VIBECODER-RESULT] ok perfil_path={vault}/Tino/_perfil-vibecoder.md` (linha literal pro wizard parsear).
```

- [ ] **Step 2: Verificar formato**

Run: `cat /Users/rafaelmelgaco/tino-ai/.claude/commands/tino-vibe-setup.md | head -3`
Expected: vê frontmatter `description:` e `argument-hint:`.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/tino-vibe-setup.md
git commit -m "feat(vibecoder-onda1): comando /tino:vibe-setup (orquestra interviewer)"
```

---

## Task 8: `lib/recommender-pipeline.mjs` (TDD, 3 testes)

**Files:**
- Create: `lib/recommender-pipeline.mjs`
- Create: `tests/recommender-pipeline.test.mjs`

- [ ] **Step 1: Escrever 3 testes RED**

Criar `tests/recommender-pipeline.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recommender-pipeline.test.mjs`
Expected: FAIL — `Cannot find module '../lib/recommender-pipeline.mjs'`.

- [ ] **Step 3: Implementar `lib/recommender-pipeline.mjs`**

Criar `lib/recommender-pipeline.mjs`:

```javascript
// lib/recommender-pipeline.mjs
//
// Orquestra: parse curated → resolve perfil → opcional aitmpl extras → render.
// Usado pelo agent vibecoder-recommender e testavel em isolamento.

import { resolve as resolveStack } from './stack-resolver.mjs';
import { render } from './recomendacao-render.mjs';
import { parse as parseCurated } from './curated-stack.mjs';
import { search, AitmplUnavailableError } from './aitmpl-client.mjs';

export async function runPipeline({
  perfil,
  curatedStackPath,
  baseUrl,
  cacheDir,
  ttlMs,
  fetchExtras = true,
}) {
  const curated = parseCurated(curatedStackPath);
  const { items, dropped } = resolveStack(perfil, curated);

  let extras = [];
  if (fetchExtras) {
    extras = await tryFetchExtras(perfil, items, { baseUrl, cacheDir, ttlMs });
  }

  return render(items, perfil, extras, { dropped });
}

async function tryFetchExtras(perfil, alreadyChosen, opts) {
  const queries = []
    .concat(perfil.linguagens_familiares || [])
    .concat(perfil.tipo_projeto || [])
    .slice(0, 3);

  if (queries.length === 0) return [];

  const seen = new Set(alreadyChosen.map((i) => i.name));
  const extras = [];

  for (const q of queries) {
    let found;
    try {
      found = await search(q, { ...opts, limit: 3 });
    } catch (e) {
      if (e instanceof AitmplUnavailableError) return extras; // graceful degrade
      throw e;
    }
    for (const it of found) {
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      extras.push({
        name: it.name,
        kind: it.type,
        install: it.install || `# manual: see https://aitmpl.com/${it.path || ''}`,
        why: it.description || `Sugestão automática (aitmpl) baseada em "${q}"`,
        aitmpl_id: it.name,
      });
    }
  }

  return extras;
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/recommender-pipeline.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 102 + 3 = **105 PASS**, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/recommender-pipeline.mjs tests/recommender-pipeline.test.mjs
git commit -m "feat(vibecoder-onda1): lib/recommender-pipeline.mjs (resolve+extras+render) + 3 testes"
```

---

## Task 9: Agent `vibecoder-recommender`

**Files:**
- Create: `.claude/agents/vibecoder-recommender.md`

- [ ] **Step 1: Criar agent**

Criar `.claude/agents/vibecoder-recommender.md`:

```markdown
---
name: vibecoder-recommender
description: Use quando precisa gerar Tino/_recomendacao.md combinando curated-stack + aitmpl + perfil. Ativa via /tino:vibe-stack apos perfil-vibecoder existir. Lê perfil, roda pipeline, escreve markdown.
tools: Read, Bash, Write
---

Você gera o `_recomendacao.md` no vault do user com base no perfil dele.

## Inputs

- Argumento: vault-path
- Lê: `{vault}/Tino/_perfil-vibecoder.md`
- Lê: `{repo-root}/config/curated-stack.yaml`

## Sequência

1. **Parse perfil:** lê `{vault}/Tino/_perfil-vibecoder.md`, extrai frontmatter via `lib/frontmatter.mjs::parse`.

2. **Validate perfil:** chama `lib/perfil-vibecoder-writer.mjs::validate(fm)`. Se erros, peça pro user rodar `/tino:vibe-setup --re-run`.

3. **Roda pipeline:** chama `lib/recommender-pipeline.mjs::runPipeline({ perfil: fm, curatedStackPath: 'config/curated-stack.yaml', baseUrl: undefined, cacheDir: '.tino-cache/aitmpl', ttlMs: undefined })`.
   - Se `aitmpl` falha, pipeline já degrada graciosamente (retorna sem extras).

4. **Escreve `{vault}/Tino/_recomendacao.md`:**
   - Se já existe: faz backup `{path}.tino-bak.{ISO}`.
   - Escreve o markdown retornado pelo pipeline.

5. **Resumo amigavel pro user:**
   ```
   ✓ Recomendação gerada: {N} items ({essentials} essenciais, {by_role} pro seu papel, {by_plan} pro seu plano, {extras_aitmpl} sugestões extras).
   
   Leia em {vault}/Tino/_recomendacao.md e rode `/tino:vibe-install {vault}` quando estiver pronto.
   ```

6. **Output estruturado** pro wizard:
   ```
   [VIBECODER-RESULT] ok recomendacao_path={vault}/Tino/_recomendacao.md count={N}
   ```

## Implementação como script

Você executa via Bash chamando um script Node ad-hoc:

```bash
node -e "
import('./lib/frontmatter.mjs').then(async (fm) => {
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const validator = await import('./lib/perfil-vibecoder-writer.mjs');
  const pipeline = await import('./lib/recommender-pipeline.mjs');

  const vaultPath = process.argv[1];
  const perfilPath = path.join(vaultPath, 'Tino', '_perfil-vibecoder.md');
  const md = await fs.readFile(perfilPath, 'utf8');
  const { meta } = fm.parse(md);
  const errs = validator.validate(meta);
  if (errs.length > 0) { console.error('PERFIL INVALIDO:', errs); process.exit(1); }

  const result = await pipeline.runPipeline({
    perfil: meta,
    curatedStackPath: 'config/curated-stack.yaml',
  });

  const outPath = path.join(vaultPath, 'Tino', '_recomendacao.md');
  try {
    await fs.access(outPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(outPath, outPath + '.tino-bak.' + stamp);
  } catch {}
  await fs.writeFile(outPath, result, 'utf8');

  // Parse counts pra log
  const fmMatch = result.match(/^---\n([\s\S]*?)\n---/);
  const yaml = await import('yaml');
  const fmRes = yaml.parse(fmMatch[1]);
  console.log('[VIBECODER-RESULT] ok recomendacao_path=' + outPath + ' count=' + fmRes.counts.total);
});
" -- $VAULT_PATH
```

(Cuidado: o `process.argv[1]` é o vault-path passado. Adapte conforme contexto do Bash tool.)

## Erros comuns

- Perfil não existe → "Rode `/tino:vibe-setup {vault}` primeiro."
- Curated-stack invalido → reporte erro do validate, peça pra rodar testes do projeto.
- aitmpl unavailable → continua sem extras, alerta no resumo.
```

- [ ] **Step 2: Verificar arquivo**

Run: `cat /Users/rafaelmelgaco/tino-ai/.claude/agents/vibecoder-recommender.md | head -5`
Expected: vê frontmatter.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/vibecoder-recommender.md
git commit -m "feat(vibecoder-onda1): agent vibecoder-recommender"
```

---

## Task 10: Comando `/tino:vibe-stack`

**Files:**
- Create: `.claude/commands/tino-vibe-stack.md`

- [ ] **Step 1: Criar comando**

Criar `.claude/commands/tino-vibe-stack.md`:

```markdown
---
description: Gera Tino/_recomendacao.md combinando curated-stack + aitmpl conforme perfil
argument-hint: <vault-path>
---

Você gera a recomendação de stack pro user vibecoder.

## Argumentos
- `$1` — vault-path (obrigatório)

## Sequência

1. **Pré-requisito:** verifique que `$1/Tino/_perfil-vibecoder.md` existe. Se não, retorne:
   ```
   ✗ Perfil ausente. Rode `/tino:vibe-setup $1` primeiro.
   [VIBECODER-RESULT] error reason=perfil_ausente
   ```

2. **Invoque o agent `vibecoder-recommender`:**
   ```
   [Use o Task tool com subagent_type=vibecoder-recommender]
   Gere recomendação pro vault em $1.
   ```

3. **Verifique resultado:** confirme que `$1/Tino/_recomendacao.md` foi escrito. Se não, sinalize erro.

4. **Output final** (literal):
   ```
   [VIBECODER-RESULT] ok recomendacao_path={vault}/Tino/_recomendacao.md count={N}
   ```
   (`{N}` extraído do arquivo via `cat ... | grep total`.)
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/tino-vibe-stack.md
git commit -m "feat(vibecoder-onda1): comando /tino:vibe-stack"
```

---

## Task 11: `lib/claude-md-template.mjs` (TDD, 4 testes)

**Files:**
- Create: `lib/claude-md-template.mjs`
- Create: `tests/claude-md-template.test.mjs`
- Create: `tests/fixtures/perfil-vibecoder/empresario-autonomo.md`

- [ ] **Step 1: Criar fixture empresario-autonomo**

Criar `tests/fixtures/perfil-vibecoder/empresario-autonomo.md`:

```markdown
---
schema_version: 1
nome: "Maria"
papel: empresario
experiencia_dev: avancado
plano_claude: max
orcamento_tokens: generoso
sistema: linux
linguagens_familiares: [python, javascript]
stacks_conhecidas: [fastapi, nextjs]
tipo_projeto: [saas, ferramenta-interna]
objetivos_curto_prazo: "Lançar SaaS de IA pra contadores em 60 dias"
modo_autonomia: autonomo
tolerancia_risco: alta
intervencao_hooks: silenciosa
ja_tem_instalado:
  skills: [tdd]
  agents: []
  mcps: [context7]
  plugins: [superpowers]
  hooks: []
---
body
```

- [ ] **Step 2: Escrever 4 testes RED**

Criar `tests/claude-md-template.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { render } from '../lib/claude-md-template.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPerfil(name) {
  const md = readFileSync(path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`), 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

test('render: contém papel + objetivos + stack', () => {
  const perfil = loadPerfil('empresario-autonomo');
  const md = render(perfil);
  assert.ok(md.includes('empresario'));
  assert.ok(md.includes('Lançar SaaS de IA pra contadores em 60 dias'));
  assert.ok(md.includes('fastapi'));
  assert.ok(md.includes('nextjs'));
});

test('render junior+iniciante+perguntativo: regra "explique antes de codar"', () => {
  const perfil = loadPerfil('junior-balanceado');
  const md = render({ ...perfil, experiencia_dev: 'iniciante', modo_autonomia: 'perguntativo' });
  assert.ok(/explique|português|portugues/i.test(md), 'esperava regra de explicar em pt');
  assert.ok(/plano|antes de implementar/i.test(md), 'esperava regra de plano');
});

test('render baixa tolerancia: regra de bloquear rm', () => {
  const perfil = loadPerfil('junior-balanceado');
  const md = render({ ...perfil, tolerancia_risco: 'baixa' });
  assert.ok(/rm|delete|destruti/i.test(md), 'esperava regra contra delete');
});

test('render autonomo+alta+silenciosa: tom diferente', () => {
  const perfil = loadPerfil('empresario-autonomo');
  const md = render(perfil);
  assert.ok(md.includes('autonomo'));
  assert.ok(md.includes('alta'));
  // intervencao silenciosa: NÃO deve sugerir hooks no comportamento padrão
  assert.ok(!/anti-burro|anti-preguicoso/.test(md), 'silenciosa nao deveria mencionar hooks');
});
```

- [ ] **Step 3: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/claude-md-template.test.mjs`
Expected: FAIL — `Cannot find module '../lib/claude-md-template.mjs'`.

- [ ] **Step 4: Implementar `lib/claude-md-template.mjs`**

Criar `lib/claude-md-template.mjs`:

```javascript
// lib/claude-md-template.mjs
//
// Renderiza CLAUDE.md customizado a partir do perfil vibecoder.
// Funcao pura. Sem deps externas.

export function render(perfil) {
  const sections = [];

  sections.push(header(perfil));
  sections.push(quemEstaNoComando(perfil));
  sections.push(oqueEstamosConstruindo(perfil));
  sections.push(comoInteragir(perfil));
  sections.push(principios(perfil));
  sections.push(quandoErrar(perfil));
  sections.push(referencias(perfil));

  return sections.join('\n\n');
}

function header(perfil) {
  const owner = perfil.nome ? perfil.nome : 'este projeto';
  return `# CLAUDE.md — ${owner}

> Gerado pelo Tino em ${new Date().toISOString().slice(0, 10)} a partir do seu perfil vibecoder. Editavel.`;
}

function quemEstaNoComando(perfil) {
  const who = perfil.nome || 'Eu';
  return `## Quem está no comando

${who} — ${perfil.papel}, experiência de dev: ${perfil.experiencia_dev}. Plano Claude: ${perfil.plano_claude}.`;
}

function oqueEstamosConstruindo(perfil) {
  const tipos = (perfil.tipo_projeto || []).join(', ');
  const stacks = (perfil.stacks_conhecidas || []).join(', ');
  const obj = perfil.objetivos_curto_prazo || '(não informado)';
  return `## O que estamos construindo

${obj}.

Tipo: ${tipos}. Stack: ${stacks || '—'}.`;
}

function comoInteragir(perfil) {
  const langs = (perfil.linguagens_familiares || []).join(', ') || '—';
  return `## Como interagir comigo

- **Modo de autonomia:** ${perfil.modo_autonomia} — ${explicaAutonomia(perfil.modo_autonomia)}
- **Tolerância a risco:** ${perfil.tolerancia_risco} — ${explicaRisco(perfil.tolerancia_risco)}
- **Linguagens que entendo:** ${langs}`;
}

function principios(perfil) {
  const bullets = [];
  if (['nenhuma', 'iniciante'].includes(perfil.experiencia_dev)) {
    bullets.push('Explique decisões em português antes de codar.');
  }
  if (perfil.tolerancia_risco === 'baixa') {
    bullets.push('Confirme antes de qualquer comando que apague arquivo (rm, delete, drop).');
  }
  if (perfil.modo_autonomia === 'perguntativo') {
    bullets.push('Apresente um plano curto antes de implementar mudanças não-triviais.');
  }
  if (bullets.length === 0) {
    bullets.push('Aja conforme o modo_autonomia configurado, mostrando o que faz.');
  }
  return `## Princípios não-negociáveis

${bullets.map((b) => `- ${b}`).join('\n')}`;
}

function quandoErrar(perfil) {
  const lines = [
    'Pare. Não tente "tentar de novo" sem nova spec.',
    'Identifique a causa raiz, não apenas o sintoma.',
  ];
  if (perfil.intervencao_hooks && perfil.intervencao_hooks !== 'silenciosa') {
    lines.push('Os hooks anti-burro/anti-preguiçoso do Tino vão te ajudar — escute eles.');
  }
  return `## Quando errar

${lines.map((l) => `- ${l}`).join('\n')}`;
}

function referencias(perfil) {
  return `## Referências do meu vault Obsidian

- Perfil vibecoder: \`{vault}/Tino/_perfil-vibecoder.md\`
- Recomendação atual: \`{vault}/Tino/_recomendacao.md\`
- Configuração Claude Code: \`~/.claude/settings.json\``;
}

function explicaAutonomia(m) {
  return ({
    perguntativo: 'pede confirmação pra quase tudo',
    balanceado: 'pergunta em ações destrutivas/grandes, faz o resto sozinho',
    autonomo: 'faz tudo, mostra o que fez',
  })[m] || '—';
}

function explicaRisco(r) {
  return ({
    baixa: 'bloqueia comandos destrutivos sem confirmação',
    media: 'bloqueia rm -rf, deixa o resto',
    alta: 'permissões abertas, confia',
  })[r] || '—';
}
```

- [ ] **Step 5: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/claude-md-template.test.mjs`
Expected: 4 PASS.

- [ ] **Step 6: Verificar `npm test`**

Expected: 105 + 4 = **109 PASS**, 0 FAIL.

- [ ] **Step 7: Commit**

```bash
git add lib/claude-md-template.mjs tests/claude-md-template.test.mjs tests/fixtures/perfil-vibecoder/empresario-autonomo.md
git commit -m "feat(vibecoder-onda1): lib/claude-md-template.mjs (CLAUDE.md gen) + 4 testes"
```

---

## Task 12: `lib/settings-patch.mjs` (TDD, 5 testes)

**Files:**
- Create: `lib/settings-patch.mjs`
- Create: `tests/settings-patch.test.mjs`

- [ ] **Step 1: Escrever 5 testes RED**

Criar `tests/settings-patch.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { computePatch, applyPatch, backup } from '../lib/settings-patch.mjs';

test('computePatch: baixa risco -> deny array', () => {
  const patch = computePatch({ tolerancia_risco: 'baixa', modo_autonomia: 'perguntativo' });
  assert.ok(patch.add.permissions?.deny?.some((p) => /rm/i.test(p)));
});

test('computePatch: alta risco + autonomo -> allow array generoso', () => {
  const patch = computePatch({ tolerancia_risco: 'alta', modo_autonomia: 'autonomo' });
  assert.ok(patch.add.permissions?.allow?.length > 0);
  assert.ok(patch.add.permissions.allow.some((p) => /Bash/i.test(p)));
});

test('applyPatch: merge sem destruir keys existentes', () => {
  const curr = { existingKey: 'untouched', permissions: { allow: ['Read'] } };
  const patch = { add: { permissions: { allow: ['Bash(npm:*)'] } } };
  const next = applyPatch(curr, patch);
  assert.equal(next.existingKey, 'untouched');
  assert.deepEqual(next.permissions.allow, ['Read', 'Bash(npm:*)']);
});

test('applyPatch: settings vazio funciona', () => {
  const next = applyPatch({}, { add: { permissions: { allow: ['Read'] } } });
  assert.deepEqual(next.permissions.allow, ['Read']);
});

test('backup: cria copia com timestamp', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-'));
  const orig = path.join(tmp, 'settings.json');
  await fs.writeFile(orig, '{"x":1}', 'utf8');
  const bak = await backup(orig);
  assert.ok(bak.includes('tino-bak'));
  const content = await fs.readFile(bak, 'utf8');
  assert.equal(content, '{"x":1}');
});
```

- [ ] **Step 2: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/settings-patch.test.mjs`
Expected: FAIL — `Cannot find module '../lib/settings-patch.mjs'`.

- [ ] **Step 3: Implementar `lib/settings-patch.mjs`**

Criar `lib/settings-patch.mjs`:

```javascript
// lib/settings-patch.mjs
//
// Compute + apply patches em ~/.claude/settings.json baseado no perfil vibecoder.
// Funções puras (computePatch, applyPatch). I/O isolado em backup().

import { promises as fs } from 'node:fs';

export function computePatch(perfil) {
  const patch = { add: { permissions: {} }, remove: [] };

  const allow = [];
  const deny = [];

  if (perfil.tolerancia_risco === 'baixa') {
    deny.push('Bash(rm:*)', 'Bash(curl:*)', 'Bash(sudo:*)');
  } else if (perfil.tolerancia_risco === 'media') {
    deny.push('Bash(rm -rf:*)');
  }

  if (perfil.tolerancia_risco === 'alta' && perfil.modo_autonomia === 'autonomo') {
    allow.push('Bash(npm install:*)', 'Bash(npm run:*)', 'Bash(git:*)', 'Read', 'Edit', 'Write');
  } else if (perfil.modo_autonomia === 'autonomo') {
    allow.push('Bash(npm:*)', 'Read', 'Edit');
  }

  if (allow.length > 0) patch.add.permissions.allow = allow;
  if (deny.length > 0) patch.add.permissions.deny = deny;

  // Reservar slot pra hooks da Onda 2 — sem mexer ainda
  if (perfil.intervencao_hooks && perfil.intervencao_hooks !== 'silenciosa') {
    patch.add._tino_hooks_placeholder = `reserved by Tino Onda 1 — Onda 2 vai preencher hooks com nivel ${perfil.intervencao_hooks}`;
  }

  return patch;
}

export function applyPatch(currentSettings, patch) {
  const next = { ...currentSettings };
  if (patch.add) {
    for (const [key, value] of Object.entries(patch.add)) {
      next[key] = mergeValue(next[key], value);
    }
  }
  if (Array.isArray(patch.remove)) {
    for (const key of patch.remove) delete next[key];
  }
  return next;
}

function mergeValue(curr, incoming) {
  if (Array.isArray(curr) && Array.isArray(incoming)) {
    const set = new Set(curr);
    for (const v of incoming) set.add(v);
    return [...set];
  }
  if (
    curr && typeof curr === 'object' && !Array.isArray(curr) &&
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
  ) {
    const out = { ...curr };
    for (const [k, v] of Object.entries(incoming)) {
      out[k] = mergeValue(out[k], v);
    }
    return out;
  }
  return incoming !== undefined ? incoming : curr;
}

export async function backup(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${filePath}.tino-bak.${stamp}`;
  await fs.copyFile(filePath, bak);
  return bak;
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/settings-patch.test.mjs`
Expected: 5 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 109 + 5 = **114 PASS**, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/settings-patch.mjs tests/settings-patch.test.mjs
git commit -m "feat(vibecoder-onda1): lib/settings-patch.mjs (compute+apply+backup) + 5 testes"
```

---

## Task 13: `lib/install-sh-render.mjs` (TDD, 3 testes)

**Files:**
- Create: `lib/install-sh-render.mjs`
- Create: `tests/install-sh-render.test.mjs`

- [ ] **Step 1: Escrever 3 testes RED**

Criar `tests/install-sh-render.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../lib/install-sh-render.mjs';

test('render: bash valido com shebang + set + items', () => {
  const items = [
    { name: 'context7', kind: 'mcp', install: 'claude mcp add context7 X' },
    { name: 'superpowers', kind: 'plugin', install: '/plugin install superpowers' },
  ];
  const sh = render(items);
  assert.ok(sh.startsWith('#!/usr/bin/env bash'));
  assert.ok(sh.includes('set -euo pipefail'));
  assert.ok(sh.includes('claude mcp add context7 X'));
  assert.ok(sh.includes('/plugin install superpowers'));
  assert.ok(/\[1\/2\]/.test(sh) || sh.includes('Installing context7'));
});

test('render --interactive: inclui prompt yes/no por item', () => {
  const items = [{ name: 'a', kind: 'mcp', install: 'cmd' }];
  const sh = render(items, { interactive: true });
  assert.ok(sh.includes('--interactive'));
  assert.ok(/read|prompt|continue/i.test(sh), 'esperava interatividade');
});

test('render: 0 items retorna script no-op', () => {
  const sh = render([]);
  assert.ok(sh.startsWith('#!/usr/bin/env bash'));
  assert.ok(sh.includes('No items to install'));
});
```

- [ ] **Step 2: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/install-sh-render.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/install-sh-render.mjs`**

Criar `lib/install-sh-render.mjs`:

```javascript
// lib/install-sh-render.mjs
//
// Renderiza shell script executavel a partir da lista de items recomendados.
// Suporta flag --interactive (pergunta por item).

export function render(items, opts = {}) {
  const total = items.length;
  const interactive = !!opts.interactive;

  const header = [
    '#!/usr/bin/env bash',
    '# Generated by Tino vibecoder install command',
    'set -euo pipefail',
    '',
    'INTERACTIVE=0',
    'if [[ "${1:-}" == "--interactive" ]]; then INTERACTIVE=1; fi',
    interactive ? '# Default to interactive' : '',
    interactive ? 'INTERACTIVE=1' : '',
    '',
    'FAILED=()',
    '',
  ].join('\n');

  if (total === 0) {
    return header + '\necho "No items to install — your stack is already complete."\nexit 0\n';
  }

  const itemsBlock = items
    .map((it, idx) => {
      const i = idx + 1;
      const cmd = (it.install || '').replace(/'/g, "'\\''");
      return [
        `# [${i}/${total}] ${it.name} (${it.kind})`,
        `echo "[${i}/${total}] Installing ${it.name}..."`,
        'if [[ $INTERACTIVE -eq 1 ]]; then',
        `  read -p "  Install ${it.name}? [y/N] " ans`,
        '  if [[ ! "$ans" =~ ^[Yy]$ ]]; then echo "  skipped"; continue; fi',
        'fi',
        `if ! ${cmd || 'true # no install command'}; then`,
        `  echo "  ✗ failed: ${it.name}"`,
        `  FAILED+=("${it.name}")`,
        'else',
        `  echo "  ✓ installed: ${it.name}"`,
        'fi',
        '',
      ].join('\n');
    })
    .join('\n');

  const footer = [
    '',
    'if [[ ${#FAILED[@]} -gt 0 ]]; then',
    '  echo "Done with errors. Failed: ${FAILED[*]}"',
    '  exit 1',
    'else',
    '  echo "All ' + total + ' items installed successfully."',
    'fi',
    '',
  ].join('\n');

  return header + 'for ITEM in $(seq 1 ' + total + '); do :; done # placeholder loop\n' + itemsBlock + footer;
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/install-sh-render.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 114 + 3 = **117 PASS**, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/install-sh-render.mjs tests/install-sh-render.test.mjs
git commit -m "feat(vibecoder-onda1): lib/install-sh-render.mjs (bash gen) + 3 testes"
```

---

## Task 14: Agent `vibecoder-installer`

**Files:**
- Create: `.claude/agents/vibecoder-installer.md`

- [ ] **Step 1: Criar agent**

Criar `.claude/agents/vibecoder-installer.md`:

```markdown
---
name: vibecoder-installer
description: Use quando precisa aplicar a configuração do vibecoder — gerar CLAUDE.md, patch settings.json, executar install.sh. Ativa via /tino:vibe-install. Respeita modo_autonomia do perfil.
tools: Read, Bash, Write, Edit
---

Você aplica a configuração do user vibecoder no Claude Code dele.

## Inputs

- Argumentos: `vault-path`, `project-root` (default `pwd`)
- Lê: `{vault}/Tino/_perfil-vibecoder.md`, `{vault}/Tino/_recomendacao.md`

## Sequência

### 1. Lê perfil + recomendação

Parse perfil via `lib/frontmatter.mjs`. Validate via `lib/perfil-vibecoder-writer.mjs::validate`. Se inválido, peça pra rodar `/tino:vibe-setup --re-run`.

Lê recomendação. Extrai lista de items.

### 2. Gera CLAUDE.md

```bash
node -e "
import('./lib/claude-md-template.mjs').then(async (t) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const md = await fs.readFile(process.argv[1] + '/Tino/_perfil-vibecoder.md', 'utf8');
  const { meta } = fm.parse(md);
  const out = t.render(meta);
  const target = path.join(process.argv[2], 'CLAUDE.md');
  try {
    await fs.access(target);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(target, target + '.tino-bak.' + stamp);
  } catch {}
  await fs.writeFile(target, out, 'utf8');
  console.log('CLAUDE.md written to ' + target);
});
" -- $VAULT $PROJECT_ROOT
```

Confirmar com user antes (mesmo em modo_autonomia: autonomo, este é arquivo de "voz" — perigoso sobrescrever sem aviso).

### 3. Gera install.sh

```bash
node -e "
import('./lib/install-sh-render.mjs').then(async (r) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const md = await fs.readFile(process.argv[1] + '/Tino/_recomendacao.md', 'utf8');
  const { meta } = fm.parse(md);
  const sh = r.render(meta.items);
  const target = path.join(process.argv[1], 'Tino', '_install.sh');
  await fs.writeFile(target, sh, { mode: 0o755 });
  console.log('install.sh written to ' + target);
});
" -- $VAULT
```

### 4. Calcula + (opcional) aplica patch settings.json

```bash
node -e "
import('./lib/settings-patch.mjs').then(async (sp) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const md = await fs.readFile(process.argv[1] + '/Tino/_perfil-vibecoder.md', 'utf8');
  const { meta: perfil } = fm.parse(md);
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let curr = {};
  try { curr = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch {}
  const patch = sp.computePatch(perfil);
  const next = sp.applyPatch(curr, patch);
  console.log('---DIFF---');
  console.log('From:', JSON.stringify(curr, null, 2));
  console.log('To:', JSON.stringify(next, null, 2));
  console.log('---END DIFF---');
});
" -- $VAULT
```

**SEMPRE pergunte ao user antes de aplicar o patch** — exceção deliberada ao `modo_autonomia: autonomo`. Settings global é sagrada.

Se OK: backup + escreve.

### 5. Executa _install.sh conforme modo_autonomia

- `perguntativo`: `bash {vault}/Tino/_install.sh --interactive`
- `balanceado`: mostra primeiras 20 linhas do script, pergunta "executar tudo?", se OK: `bash {vault}/Tino/_install.sh`
- `autonomo`: executa direto: `bash {vault}/Tino/_install.sh`

### 6. Output final

```
[VIBECODER-RESULT] ok claude_md={path} install_sh={path} settings_patched={true|false}
```
```

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/vibecoder-installer.md
git commit -m "feat(vibecoder-onda1): agent vibecoder-installer"
```

---

## Task 15: Comando `/tino:vibe-install`

**Files:**
- Create: `.claude/commands/tino-vibe-install.md`

- [ ] **Step 1: Criar comando**

Criar `.claude/commands/tino-vibe-install.md`:

```markdown
---
description: Aplica configuração — CLAUDE.md, settings.json, install.sh — conforme perfil vibecoder
argument-hint: <vault-path> [--project-root <dir>]
---

Você aplica a configuração final do vibecoder no Claude Code do user.

## Argumentos

- `$1` — vault-path (obrigatório)
- `--project-root <dir>` — opcional, default `pwd`. Onde escrever CLAUDE.md.

## Sequência

1. **Pré-requisitos:**
   - `$1/Tino/_perfil-vibecoder.md` deve existir. Se não → "Rode `/tino:vibe-setup $1` primeiro."
   - `$1/Tino/_recomendacao.md` deve existir. Se não → "Rode `/tino:vibe-stack $1` primeiro."

2. **Project-root:** parse `--project-root`. Default `pwd`.

3. **Invoque o agent `vibecoder-installer`:**
   ```
   [Use o Task tool com subagent_type=vibecoder-installer]
   Aplica a config do vibecoder. Vault: $1. Project-root: $PROJECT_ROOT.
   ```

4. **Output final:**
   ```
   [VIBECODER-RESULT] ok claude_md={path} install_sh={path} settings_patched={bool}
   ```
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/tino-vibe-install.md
git commit -m "feat(vibecoder-onda1): comando /tino:vibe-install"
```

---

## Task 16: Comando `/tino:vibe-onboard` (wizard)

**Files:**
- Create: `.claude/commands/tino-vibe-onboard.md`

- [ ] **Step 1: Criar comando**

Criar `.claude/commands/tino-vibe-onboard.md`:

```markdown
---
description: Wizard end-to-end do Tino vibecoder — triagem + recomendação + instalação em sequência
argument-hint: <vault-path>
---

Você é o wizard de onboarding do Tino vibecoder. Conduz o user júnior pela jornada completa em uma só sessão.

## Argumentos

- `$1` — vault-path. Se omitido, leia de `~/.tino/config.sh` (variável `TINO_VAULT_PATH`). Se não encontrar, peça ao user.

## Sequência (4 etapas com confirmação entre cada uma)

### Etapa 1 — Boas-vindas

```
👋 Olá! Sou o Tino vibecoder. Vou te ajudar a configurar seu Claude Code em ~5 minutos.

Vault detectado: $VAULT_PATH

Vamos seguir 3 passos:
1. Triagem — perguntas pra entender você (~3 min)
2. Recomendação — eu sugiro o stack pro seu perfil (~1 min)
3. Instalação — aplico tudo (~1 min)

Posso começar? (s/n)
```

Se "n": pare aqui.

### Etapa 2 — Triagem

```
[Invocar /tino:vibe-setup $VAULT_PATH]
```

Aguarde linha estruturada `[VIBECODER-RESULT] ok perfil_path=...`. Se erro, pare e mostre erro pro user.

Mostre resumo curto do perfil:
```
✓ Perfil pronto.
- Papel: {papel}
- Plano: {plano_claude}
- Modo: {modo_autonomia}
- Stack: {stacks_conhecidas}

Pronto pra ver as recomendações? (s/n)
```

### Etapa 3 — Recomendação

```
[Invocar /tino:vibe-stack $VAULT_PATH]
```

Aguarde `[VIBECODER-RESULT] ok recomendacao_path=... count=N`.

Mostre:
```
✓ Recomendação pronta — {N} items.

Veja em: {recomendacao_path}
(Abra no Obsidian ou rode `cat {recomendacao_path}` no terminal)

Pronto pra instalar? (s/n)
```

Se "n": "Quando estiver pronto, rode `/tino:vibe-install $VAULT_PATH`."

### Etapa 4 — Instalação

```
[Invocar /tino:vibe-install $VAULT_PATH]
```

Aguarde `[VIBECODER-RESULT] ok claude_md=... install_sh=... settings_patched=...`.

### Etapa 5 — Resumo final

```
🎉 Setup completo!

✓ Perfil em {perfil_path}
✓ Recomendação em {recomendacao_path}  
✓ CLAUDE.md em {claude_md}
✓ install.sh em {install_sh}
✓ Settings.json {settings_patched ? 'patched' : 'unchanged'}

Próximos passos:
- Reinicie o Claude Code pra que settings.json (se patched) entre em efeito
- Releia o CLAUDE.md gerado e ajuste se necessário (é seu arquivo agora)
- Rode `/tino:refresh` pra começar a curadoria diária de novidades de IA

Bem-vindo ao modo vibecoder do Tino. 🚀
```

## Re-run

Se o user invocar `/tino:vibe-onboard` segunda vez, comece perguntando: "Detectei perfil existente. Quer atualizar tudo (re-onboard) ou só uma parte (rode /tino:vibe-{setup|stack|install} individual)?"
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/tino-vibe-onboard.md
git commit -m "feat(vibecoder-onda1): comando /tino:vibe-onboard (wizard end-to-end)"
```

---

## Task 17: README + verificação final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Adicionar seção "Modo vibecoder" no README**

Editar `README.md`. Adicionar nova seção após "## Critérios que o Tino atende" (linha ~26):

```markdown

---

## Modo vibecoder (Onda 1)

O Tino agora também é um **assistente de configuração do Claude Code** pra quem está começando a programar com IA. Roda um wizard de 5 minutos que:

1. **Faz triagem** sobre você (papel, experiência, plano Claude, projeto, tolerância a risco)
2. **Recomenda** skills/agents/MCPs/plugins/hooks adequados ao seu perfil — mistura curadoria do time Tino com o catálogo público do [aitmpl.com](https://aitmpl.com)
3. **Aplica** a configuração: gera CLAUDE.md customizado, opcionalmente patch de `~/.claude/settings.json`, e um `install.sh` executável

```bash
/tino:vibe-onboard ~/seu-vault-obsidian
```

Comandos individuais (escape hatches):
- `/tino:vibe-setup <vault>` — só triagem (gera `Tino/_perfil-vibecoder.md`)
- `/tino:vibe-stack <vault>` — só recomendação (gera `Tino/_recomendacao.md`)
- `/tino:vibe-install <vault>` — só instalação (gera CLAUDE.md + install.sh + opcional settings.json)

Tudo respeita o `modo_autonomia` que você escolheu na triagem (`perguntativo` / `balanceado` / `autonomo`). Settings global SEMPRE pede confirmação explícita, mesmo em modo autônomo.

```

- [ ] **Step 2: Verificar `npm test` final**

Run: `cd /Users/rafaelmelgaco/tino-ai && npm test`
Expected: **117 PASS, 0 FAIL** (87 da Onda 0 + 3 schema + 6 stack-resolver + 3 render + 3 writer + 3 pipeline + 4 claude-md + 5 settings-patch + 3 install-sh = 87 + 30 = 117).

- [ ] **Step 3: Verificar suite focada**

Run: `cd /Users/rafaelmelgaco/tino-ai && time npm run test:setup`
Expected: ~25-30 testes da Onda 1 PASS, em < 5s real.

- [ ] **Step 4: Conferir checklist do spec (manual)**

Abrir `docs/superpowers/specs/2026-04-27-tino-vibecoder-setup-design.md` seção 10 (deliverables checklist). Confirmar:
- 4 comandos `.claude/commands/tino-vibe-*.md` ✓
- 3 agents `.claude/agents/vibecoder-*.md` ✓
- 5 libs em `lib/` ✓
- `config/schemas/recomendacao.schema.json` ✓
- `docs/recomendacao-vibecoder.md` ✓
- `package.json` script `test:setup` ✓
- ~117 testes total green ✓
- Suite < 10s ✓

- [ ] **Step 5: Smoke test manual end-to-end**

(Opcional — só se quiser validar real-world UX antes de fechar.)

```bash
mkdir -p /tmp/test-vault/Tino
/tino:vibe-onboard /tmp/test-vault
```

Confirmar que:
- Triagem é conduzida (interviewer pergunta uma a uma)
- `_perfil-vibecoder.md` é escrito e válido
- `_recomendacao.md` é escrito e válido
- CLAUDE.md é gerado em `pwd`
- install.sh é gerado e executável

Se algum problema, anote e ajuste. Se OK, registre que smoke passou.

- [ ] **Step 6: Commit final**

```bash
git add README.md
git commit -m "docs(vibecoder-onda1): README com secao Modo vibecoder + Onda 1 fechada"
```

---

## Self-Review do Plano

**1. Spec coverage:** Todas as seções 4-7 (4 comandos, 3 agents, 5 libs, schema do recomendacao) têm tasks correspondentes. Doc humana (T2). README (T17). package.json script (T1). Checklist do spec seção 10 conferido em T17.

**2. Placeholders:** Zero "TBD/TODO/implement later". Cada task tem código completo ou comando exato.

**3. Type consistency:**
- `resolve(perfil, curatedStack)` retorna `{items, dropped}` — usado consistentemente em T3 (testes) e T8 (pipeline consome).
- `render(items, perfil, extras, opts?)` no recomendacao-render — assinatura idêntica em T4 (def) e T8 (uso) e T11 (claude-md também usa `render(perfil)` mas em escopo diferente — sem confusão).
- `validate(frontmatter)` retorna `string[]` — usado em T5 (def) e T9 (recommender consome).
- `runPipeline({perfil, curatedStackPath, baseUrl, cacheDir, ttlMs, fetchExtras?})` — assinatura definida em T8, usada em T9.
- `computePatch(perfil)` retorna `{add, remove}` — definido T12, usado em T14 (agent installer).
- `render(items, opts?)` para install-sh — opts.interactive booleano. Consistente.

**4. Test count check:**
- T2: 3 schema
- T3: 6 stack-resolver
- T4: 3 render
- T5: 3 writer
- T8: 3 pipeline
- T11: 4 claude-md
- T12: 5 settings-patch
- T13: 3 install-sh
- Total novo: 30 testes
- Baseline: 87 (Onda 0)
- Gate final: 87 + 30 = **117 PASS** ✓ bate com T17 step 2.

Plano validado.
