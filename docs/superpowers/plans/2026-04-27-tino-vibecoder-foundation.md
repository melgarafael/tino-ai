# Tino Vibecoder — Onda 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a infraestrutura compartilhada (schema do perfil + cliente aitmpl.com + curated stack) que as Ondas 1 e 2 do Tino vibecoder vão consumir, sem regressão no MVP atual.

**Architecture:** Três artefatos isolados sem comunicação entre si nesta onda — JSON Schema validável + módulo `lib/` puro com cache local + YAML versionado validado por parser interno. Cada um tem seus próprios testes `node:test`. O "casamento" entre eles acontece só na Onda 1.

**Tech Stack:** Node.js 20+, ESM puro (`.mjs`), `node:test`, `node:assert/strict`, `yaml` (já instalado), `ajv` (nova dep — JSON Schema validator), opcionalmente `cheerio` (decisão na Task 1).

**Spec de referência:** `docs/superpowers/specs/2026-04-27-tino-vibecoder-foundation-design.md`

---

## File Structure

| Caminho | Responsabilidade | Tarefa |
|---|---|---|
| `config/schemas/perfil-vibecoder.schema.json` | JSON Schema draft-07 do perfil | 3 |
| `config/curated-stack.yaml` | Stack curado com seed mínimo | 10 |
| `lib/aitmpl-client.mjs` | Funções `fetchCatalog`/`fetchItem`/`search`/`invalidateCache` + 2 error types | 5-9 |
| `lib/curated-stack.mjs` | `parse(path)` + `validate(obj)` puros | 10 |
| `docs/perfil-vibecoder.md` | Doc humana de cada campo + exemplos | 4 |
| `docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md` | Achados do spike de descoberta | 1 |
| `tests/perfil-vibecoder-schema.test.mjs` | Valida fixtures contra schema | 3 |
| `tests/aitmpl-client.test.mjs` | Cache hit/miss/stale + error types + 4 funções | 5-9 |
| `tests/curated-stack.test.mjs` | Schema do YAML + integridade `incompatible` | 10 |
| `tests/fixtures/perfil-vibecoder/{valid,bad-enum,missing-required}.md` | Fixtures de validação de schema | 3 |
| `tests/fixtures/aitmpl/{catalog-skills,catalog-mcps,...}.json` | Mock responses do aitmpl | 5 |
| `tests/fixtures/aitmpl/mock-server.mjs` | HTTP server local pra testes | 5 |
| `package.json` | Adiciona `ajv`, `npm run test:foundation` | 2 |

---

## Task 1: Spike — descobrir formato do aitmpl.com

**Objetivo:** Antes de implementar `aitmpl-client.mjs`, descobrir se o aitmpl.com expõe API JSON ou só HTML. O resultado decide se precisamos de `cheerio` na Task 2 e como vamos parsear na Task 6.

**Files:**
- Create: `docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md`

**Esta task é exploração documentada, não TDD.** Deliverable é a nota de spike.

- [ ] **Step 1: Inspecionar a home do aitmpl.com**

Run:
```bash
curl -sI https://aitmpl.com | head -20
curl -s https://aitmpl.com | head -200
```

Observar: status code, `Content-Type`, presença de `<script>` com dados JSON inline, links pra `/api/*`, `application/json` em meta tags.

- [ ] **Step 2: Procurar endpoints de API explícitos**

Run:
```bash
for path in /api /api/skills /api/agents /api/catalog /api/v1 /catalog.json /sitemap.xml; do
  echo "=== $path ===" 
  curl -sI "https://aitmpl.com$path" | head -3
done
```

Observar quais endpoints retornam 200 com `Content-Type: application/json` ou XML.

- [ ] **Step 3: Inspecionar uma página de item específico**

Identificar uma URL de skill/MCP/plugin no aitmpl (navegar manualmente em https://aitmpl.com se necessário). Curl ela:
```bash
curl -s 'https://aitmpl.com/<caminho-de-um-item>' | head -150
```

Observar: dados estão em `<script type="application/ld+json">`? `<script id="__NEXT_DATA__">`? Renderizado server-side?

- [ ] **Step 4: Documentar achados**

Criar `docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md` com:

```markdown
# Spike — aitmpl.com formato de dados

**Data:** 2026-04-27
**Pra quê:** decisão entre fetch JSON puro vs HTML scraping no `lib/aitmpl-client.mjs`

## Endpoints encontrados
[listar endpoints + content-type + se retornam dados estruturados]

## Decisão: fetch direto OU scraping HTML
[uma das duas, com 1 parágrafo de razão]

## Se scraping HTML: estrutura observada
[seletores CSS úteis, padrão de dados embutidos em scripts, etc]

## Implicações pra Task 2 e Task 6
[adicionar `cheerio` à lista de deps SIM/NÃO; estratégia de parsing]
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md
git commit -m "docs(vibecoder): spike notes do formato do aitmpl.com"
```

---

## Task 2: Setup — dependências + script de teste

**Objetivo:** adicionar `ajv` (e `cheerio` se Task 1 confirmar HTML scraping) ao `package.json`, mais um script `test:foundation`.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar ajv**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm install ajv@^8.12.0
```

Expected: `package.json` ganha `"ajv": "^8.12.0"` em `dependencies`. `npm install` roda sem warnings críticos.

- [ ] **Step 2 (condicional): Instalar cheerio se spike confirmou HTML scraping**

Verificar Task 1 step 4. Se a decisão foi "scraping HTML":
```bash
cd /Users/rafaelmelgaco/tino-ai && npm install cheerio@^1.0.0
```

Se decisão foi "fetch direto JSON": **pular este step**, anotar no commit.

- [ ] **Step 3: Adicionar script `test:foundation` em `package.json`**

Editar `package.json`, na seção `scripts`, adicionar entre `"test"` e `"test:e2e"`:

```json
"test:foundation": "node --test tests/perfil-vibecoder-schema.test.mjs tests/aitmpl-client.test.mjs tests/curated-stack.test.mjs",
```

Resultado esperado da seção scripts:
```json
"scripts": {
  "test": "node --test tests/*.test.mjs",
  "test:foundation": "node --test tests/perfil-vibecoder-schema.test.mjs tests/aitmpl-client.test.mjs tests/curated-stack.test.mjs",
  "test:e2e": "playwright test",
  "test:all": "npm test && npm run test:e2e",
  "serve": "python3 -m http.server 5173",
  "dashboard:data": "node scripts/generate-dashboard-data.mjs"
}
```

- [ ] **Step 4: Verificar que MVP atual segue passando**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm test
```

Expected: 70 testes existentes do MVP continuam green. Se algum quebrou, **PARAR** — algo no `npm install` mexeu em deps existentes; investigar antes de avançar.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(vibecoder): adiciona ajv e script test:foundation"
```

(Mencionar `+ cheerio` na mensagem se Step 2 foi executado.)

---

## Task 3: JSON Schema do perfil vibecoder + fixtures + testes

**Objetivo:** criar o JSON Schema canônico do `_perfil-vibecoder.md`, três fixtures (válida + duas inválidas), e teste que valida as fixtures via `ajv`. TDD: testes primeiro, falham, depois schema, passam.

**Files:**
- Create: `config/schemas/perfil-vibecoder.schema.json`
- Create: `tests/fixtures/perfil-vibecoder/valid.md`
- Create: `tests/fixtures/perfil-vibecoder/bad-enum.md`
- Create: `tests/fixtures/perfil-vibecoder/missing-required.md`
- Create: `tests/perfil-vibecoder-schema.test.mjs`

- [ ] **Step 1: Escrever os 3 fixtures**

Criar `tests/fixtures/perfil-vibecoder/valid.md`:

```markdown
---
schema_version: 1
created_at: 2026-04-27T14:30:00Z
updated_at: 2026-04-27T14:30:00Z
nome: "Rafael"
papel: empresario
experiencia_dev: iniciante
plano_claude: max
orcamento_tokens: moderado
sistema: darwin
linguagens_familiares:
  - javascript
  - python
stacks_conhecidas:
  - nextjs
tipo_projeto:
  - saas
objetivos_curto_prazo: "Construir o assistente Tino vibecoder"
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ativa
ja_tem_instalado:
  skills: []
  agents: []
  mcps: []
  plugins: []
  hooks: []
---

## O que mais importa pra você agora
Construir Tino.

## O que você quer evitar
Erros silenciosos.

## Notas do Tino
(vazio)
```

Criar `tests/fixtures/perfil-vibecoder/bad-enum.md` (mesmo conteúdo, mas trocar `papel: empresario` por `papel: ceo` — valor não permitido):

```markdown
---
schema_version: 1
papel: ceo
experiencia_dev: iniciante
plano_claude: max
sistema: darwin
tipo_projeto:
  - saas
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ativa
---
body
```

Criar `tests/fixtures/perfil-vibecoder/missing-required.md` (omite `papel`, que é obrigatório):

```markdown
---
schema_version: 1
experiencia_dev: iniciante
plano_claude: max
sistema: darwin
tipo_projeto:
  - saas
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ativa
---
body
```

- [ ] **Step 2: Escrever o teste falhando**

Criar `tests/perfil-vibecoder-schema.test.mjs`:

```javascript
// tests/perfil-vibecoder-schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/perfil-vibecoder.schema.json'), 'utf8')
);

function loadFixture(name) {
  const md = readFileSync(
    path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`),
    'utf8'
  );
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`fixture ${name} sem frontmatter`);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  return ajv.compile(SCHEMA);
}

test('valid fixture passa no schema', () => {
  const data = loadFixture('valid');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, true, JSON.stringify(validate.errors, null, 2));
});

test('fixture com enum invalido eh rejeitada', () => {
  const data = loadFixture('bad-enum');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, false);
  assert.ok(
    validate.errors.some((e) => e.keyword === 'enum'),
    `esperava erro de enum, vieram: ${JSON.stringify(validate.errors)}`
  );
});

test('fixture sem campo obrigatorio eh rejeitada', () => {
  const data = loadFixture('missing-required');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, false);
  assert.ok(
    validate.errors.some((e) => e.keyword === 'required'),
    `esperava erro de required, vieram: ${JSON.stringify(validate.errors)}`
  );
});
```

- [ ] **Step 3: Rodar o teste pra confirmar que falha**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/perfil-vibecoder-schema.test.mjs
```

Expected: FAIL — `ENOENT: no such file or directory, open '.../config/schemas/perfil-vibecoder.schema.json'`.

- [ ] **Step 4: Criar o JSON Schema**

Criar `config/schemas/perfil-vibecoder.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://tino.ai/schemas/perfil-vibecoder.schema.json",
  "title": "Perfil Vibecoder",
  "description": "Perfil do user vibecoder no Tino — informa recomendacoes de stack, comportamento de hooks e setup do Claude Code",
  "type": "object",
  "required": [
    "schema_version",
    "papel",
    "experiencia_dev",
    "plano_claude",
    "sistema",
    "tipo_projeto",
    "modo_autonomia",
    "tolerancia_risco",
    "intervencao_hooks"
  ],
  "properties": {
    "schema_version": { "type": "integer", "const": 1 },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" },
    "nome": { "type": "string", "maxLength": 200 },

    "papel": {
      "enum": ["junior", "pleno", "senior", "empresario", "curioso", "educador"]
    },
    "experiencia_dev": {
      "enum": ["nenhuma", "iniciante", "intermediario", "avancado"]
    },

    "plano_claude": {
      "enum": ["free", "pro", "max", "api", "desconhecido"]
    },
    "orcamento_tokens": {
      "enum": ["economico", "moderado", "generoso"]
    },

    "sistema": { "enum": ["darwin", "linux", "windows"] },
    "linguagens_familiares": {
      "type": "array",
      "items": { "type": "string" }
    },
    "stacks_conhecidas": {
      "type": "array",
      "items": { "type": "string" }
    },

    "tipo_projeto": {
      "type": "array",
      "minItems": 1,
      "items": {
        "enum": [
          "webapp", "mobile", "cli", "automacao",
          "conteudo", "saas", "ferramenta-interna", "outro"
        ]
      }
    },
    "objetivos_curto_prazo": { "type": "string", "maxLength": 1000 },

    "modo_autonomia": {
      "enum": ["perguntativo", "balanceado", "autonomo"]
    },
    "tolerancia_risco": {
      "enum": ["baixa", "media", "alta"]
    },
    "intervencao_hooks": {
      "enum": ["silenciosa", "ativa", "agressiva"]
    },

    "ja_tem_instalado": {
      "type": "object",
      "properties": {
        "skills":  { "type": "array", "items": { "type": "string" } },
        "agents":  { "type": "array", "items": { "type": "string" } },
        "mcps":    { "type": "array", "items": { "type": "string" } },
        "plugins": { "type": "array", "items": { "type": "string" } },
        "hooks":   { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 5: Rodar o teste — agora passa**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/perfil-vibecoder-schema.test.mjs
```

Expected: 3 testes PASS.

- [ ] **Step 6: Verificar que `npm test` continua green inteiro**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm test
```

Expected: 70 testes do MVP + 3 novos = 73 PASS.

- [ ] **Step 7: Commit**

```bash
git add config/schemas/perfil-vibecoder.schema.json \
        tests/fixtures/perfil-vibecoder/ \
        tests/perfil-vibecoder-schema.test.mjs
git commit -m "feat(vibecoder): JSON Schema do _perfil-vibecoder.md + fixtures + testes"
```

---

## Task 4: Doc humana do schema do perfil

**Objetivo:** doc em prosa que explica cada campo + valores aceitos + exemplo, pra user editar `_perfil-vibecoder.md` à mão sem ler JSON Schema.

**Files:**
- Create: `docs/perfil-vibecoder.md`

**Esta task não tem teste** (é doc humana). Critério de pronto: o doc é coerente com o JSON Schema da Task 3.

- [ ] **Step 1: Criar doc**

Criar `docs/perfil-vibecoder.md`:

````markdown
# `_perfil-vibecoder.md` — schema humano

Este arquivo mora em `{seu-vault-Obsidian}/Tino/_perfil-vibecoder.md`. O Tino lê pra recomendar setup do Claude Code, stack, hooks e modo de autonomia. Você pode editar manualmente — o JSON Schema canonico esta em `config/schemas/perfil-vibecoder.schema.json` (validado por `tests/perfil-vibecoder-schema.test.mjs`).

## Estrutura

Markdown com frontmatter YAML no topo + 3 secoes de body livre.

## Frontmatter — campos

### Identidade

| Campo | Obrigatorio | Valores | O que significa |
|---|---|---|---|
| `schema_version` | sim | `1` | Versao do schema. Bump quando mudar formato. |
| `created_at` | nao | ISO 8601 | Quando foi criado |
| `updated_at` | nao | ISO 8601 | Ultima edicao |
| `nome` | nao | string | Como o Tino se refere a voce |
| `papel` | sim | `junior`, `pleno`, `senior`, `empresario`, `curioso`, `educador` | Papel principal — informa recomendacao de stack |
| `experiencia_dev` | sim | `nenhuma`, `iniciante`, `intermediario`, `avancado` | Separado de `papel` porque empresario pode ser ex-engenheiro |

### Plano e recursos

| Campo | Obrigatorio | Valores | O que significa |
|---|---|---|---|
| `plano_claude` | sim | `free`, `pro`, `max`, `api`, `desconhecido` | Plano que voce usa |
| `orcamento_tokens` | nao | `economico`, `moderado`, `generoso` | Independente do plano — alguem no Max pode querer modo economico |

### Stack atual

| Campo | Obrigatorio | Valores | O que significa |
|---|---|---|---|
| `sistema` | sim | `darwin`, `linux`, `windows` | Afeta install commands |
| `linguagens_familiares` | nao | array de string | Lowercase. Ex: `["javascript", "python"]` |
| `stacks_conhecidas` | nao | array de string | Frameworks/libs. Ex: `["nextjs", "react", "tailwind"]` |

### Intencao

| Campo | Obrigatorio | Valores | O que significa |
|---|---|---|---|
| `tipo_projeto` | sim | array de `webapp`, `mobile`, `cli`, `automacao`, `conteudo`, `saas`, `ferramenta-interna`, `outro` | Pelo menos 1 |
| `objetivos_curto_prazo` | nao | string ate 1000 chars | 1-2 frases narrativas |

### Comportamento Claude Code

| Campo | Obrigatorio | Valores | O que significa |
|---|---|---|---|
| `modo_autonomia` | sim | `perguntativo`, `balanceado`, `autonomo` | Quanto o Claude pede confirmacao |
| `tolerancia_risco` | sim | `baixa`, `media`, `alta` | Permissoes mais ou menos abertas |
| `intervencao_hooks` | sim | `silenciosa`, `ativa`, `agressiva` | Quao alto os hooks anti-preguicoso/anti-burro gritam |

Combinacao "autonomo + agressiva" eh coerente: faz mais sozinho mas com mais salvaguardas.

### Inventario (`ja_tem_instalado`)

Objeto com 5 listas de string: `skills`, `agents`, `mcps`, `plugins`, `hooks`. Evita o Tino sugerir o que voce ja tem.

## Body — 3 secoes obrigatorias

```markdown
## O que mais importa pra você agora
[narrativa coletada na triagem da Onda 1]

## O que você quer evitar
[anti-padroes, dores passadas]

## Notas do Tino
[secao que o Tino atualiza ao longo do tempo — observacoes de uso]
```

## Exemplo completo

Veja `tests/fixtures/perfil-vibecoder/valid.md`.

## Como migrar entre versoes

Quando o `schema_version` subir (ex: 1 -> 2), o Tino vai oferecer um comando de migracao. Por enquanto so existe a versao 1.
````

- [ ] **Step 2: Verificar coerencia com schema**

Conferir manualmente que cada campo descrito existe no schema da Task 3 com os mesmos valores aceitos. Se divergente, corrigir o doc (schema eh fonte de verdade).

- [ ] **Step 3: Commit**

```bash
git add docs/perfil-vibecoder.md
git commit -m "docs(vibecoder): doc humana do schema _perfil-vibecoder.md"
```

---

## Task 5: aitmpl-client scaffold + mock server + primeiro teste falhando

**Objetivo:** criar a estrutura do `lib/aitmpl-client.mjs` com error types + assinaturas (sem implementação), o mock HTTP server, e o primeiro teste de `fetchCatalog` que vai guiar a implementação na Task 6.

**Files:**
- Create: `lib/aitmpl-client.mjs`
- Create: `tests/fixtures/aitmpl/mock-server.mjs`
- Create: `tests/fixtures/aitmpl/catalog-skills.json`
- Create: `tests/fixtures/aitmpl/catalog-mcps.json`
- Create: `tests/aitmpl-client.test.mjs`

- [ ] **Step 1: Criar fixtures de catalog**

Criar `tests/fixtures/aitmpl/catalog-skills.json`:

```json
{
  "items": [
    {
      "id": "superpowers-tdd",
      "name": "TDD",
      "kind": "skill",
      "description": "Test-driven development discipline",
      "install": "/plugin install superpowers"
    },
    {
      "id": "frontend-design",
      "name": "Frontend Design",
      "kind": "skill",
      "description": "Build distinctive frontend interfaces",
      "install": "/plugin install frontend-design"
    }
  ]
}
```

Criar `tests/fixtures/aitmpl/catalog-mcps.json`:

```json
{
  "items": [
    {
      "id": "context7",
      "name": "context7",
      "kind": "mcp",
      "description": "Live library docs",
      "install": "claude mcp add context7 https://mcp.context7.com/mcp"
    }
  ]
}
```

- [ ] **Step 2: Criar mock HTTP server**

Criar `tests/fixtures/aitmpl/mock-server.mjs`:

```javascript
// tests/fixtures/aitmpl/mock-server.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Roteamento:
 *   GET /api/catalog/<kind>     -> tests/fixtures/aitmpl/catalog-<kind>.json
 *   GET /api/item/<kind>/<id>   -> procura id em catalog-<kind>.json, 404 se nao achar
 *   GET /api/search?q=...       -> procura em todos catalogs, retorna { items: [...] }
 *   GET /__fail                 -> simula falha de rede (responde 500)
 *
 * Retorna { server, baseUrl, setFailMode }.
 */
export async function startMockServer() {
  let failMode = false;

  const server = createServer((req, res) => {
    if (failMode) {
      res.writeHead(500);
      res.end('mock failure');
      return;
    }

    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    // /api/catalog/<kind>
    let m = p.match(/^\/api\/catalog\/([\w-]+)$/);
    if (m) {
      const fixturePath = path.join(__dirname, `catalog-${m[1]}.json`);
      if (existsSync(fixturePath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(readFileSync(fixturePath));
        return;
      }
      res.writeHead(404);
      res.end();
      return;
    }

    // /api/item/<kind>/<id>
    m = p.match(/^\/api\/item\/([\w-]+)\/([\w-]+)$/);
    if (m) {
      const fixturePath = path.join(__dirname, `catalog-${m[1]}.json`);
      if (!existsSync(fixturePath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const catalog = JSON.parse(readFileSync(fixturePath, 'utf8'));
      const item = catalog.items.find((it) => it.id === m[2]);
      if (!item) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(item));
      return;
    }

    // /api/search?q=...
    if (p === '/api/search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const kinds = ['skills', 'mcps', 'agents', 'commands', 'hooks', 'plugins'];
      const matches = [];
      for (const k of kinds) {
        const f = path.join(__dirname, `catalog-${k}.json`);
        if (!existsSync(f)) continue;
        const cat = JSON.parse(readFileSync(f, 'utf8'));
        for (const it of cat.items) {
          if (
            it.name.toLowerCase().includes(q) ||
            (it.description || '').toLowerCase().includes(q)
          ) {
            matches.push(it);
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: matches }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    setFailMode: (v) => {
      failMode = v;
    },
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
```

- [ ] **Step 3: Criar scaffold do aitmpl-client**

Criar `lib/aitmpl-client.mjs`:

```javascript
// lib/aitmpl-client.mjs
//
// Cliente do catalogo aitmpl.com. Funcoes puras + cache local em
// .tino-cache/aitmpl/. Veja docs/superpowers/specs/2026-04-27-tino-vibecoder-foundation-design.md
// secao 5 pra contrato.

const DEFAULT_BASE_URL = 'https://aitmpl.com';
const DEFAULT_CACHE_DIR = '.tino-cache/aitmpl';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export class AitmplUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AitmplUnavailableError';
    this.cause = cause;
  }
}

export class AitmplSchemaError extends Error {
  constructor(message, sample) {
    super(message);
    this.name = 'AitmplSchemaError';
    this.sample = sample;
  }
}

/**
 * Resolve TTL em ms a partir de opts ou env TINO_AITMPL_TTL (segundos).
 */
export function resolveTtlMs(opts = {}) {
  if (typeof opts.ttlMs === 'number') return opts.ttlMs;
  const env = parseInt(process.env.TINO_AITMPL_TTL || '', 10);
  if (Number.isFinite(env) && env > 0) return env * 1000;
  return DEFAULT_TTL_MS;
}

export function defaults() {
  return {
    baseUrl: DEFAULT_BASE_URL,
    cacheDir: DEFAULT_CACHE_DIR,
    ttlMs: DEFAULT_TTL_MS,
  };
}

/**
 * Busca catalogo (todas as kinds ou subset).
 * Implementacao virá na Task 6.
 */
export async function fetchCatalog(opts = {}) {
  throw new Error('fetchCatalog: not implemented yet');
}

/**
 * Busca item especifico. Retorna null em 404.
 * Implementacao virá na Task 7.
 */
export async function fetchItem(kind, id, opts = {}) {
  throw new Error('fetchItem: not implemented yet');
}

/**
 * Busca textual no catalogo.
 * Implementacao virá na Task 8.
 */
export async function search(query, opts = {}) {
  throw new Error('search: not implemented yet');
}

/**
 * Invalida cache (kind especifico ou tudo).
 * Implementacao virá na Task 9.
 */
export async function invalidateCache(kind = null, opts = {}) {
  throw new Error('invalidateCache: not implemented yet');
}
```

- [ ] **Step 4: Criar arquivo de teste com setup compartilhado e PRIMEIRO teste de fetchCatalog**

Criar `tests/aitmpl-client.test.mjs`:

```javascript
// tests/aitmpl-client.test.mjs
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  fetchCatalog,
  fetchItem,
  search,
  invalidateCache,
  AitmplUnavailableError,
  AitmplSchemaError,
} from '../lib/aitmpl-client.mjs';
import { startMockServer } from './fixtures/aitmpl/mock-server.mjs';

let mock;
let cacheDir;

before(async () => {
  mock = await startMockServer();
});

after(async () => {
  if (mock) await mock.stop();
});

beforeEach(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-aitmpl-cache-'));
});

function makeOpts(extra = {}) {
  return {
    baseUrl: mock.baseUrl,
    cacheDir,
    ttlMs: 60_000,
    ...extra,
  };
}

// ===== fetchCatalog =====

test('fetchCatalog: busca catalog de skills do mock e retorna items', async () => {
  const cat = await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  assert.ok(cat.items, 'deveria retornar { items }');
  assert.ok(Array.isArray(cat.items.skills), 'items.skills deveria ser array');
  assert.equal(cat.items.skills.length, 2);
  assert.equal(cat.items.skills[0].id, 'superpowers-tdd');
});

test('fetchCatalog: cache hit nao bate na rede', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  mock.setFailMode(true);
  const cat = await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  mock.setFailMode(false);
  assert.equal(cat.items.skills.length, 2, 'deveria ter vindo do cache');
});

test('fetchCatalog: cache stale + network fail retorna stale com warning', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills'], ttlMs: 1 }));
  await new Promise((r) => setTimeout(r, 10));
  mock.setFailMode(true);
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const cat = await fetchCatalog(makeOpts({ kinds: ['skills'], ttlMs: 1 }));
    assert.equal(cat.items.skills.length, 2);
    assert.ok(warnings.some((w) => w.includes('stale')), `esperava warning de stale, vieram: ${warnings}`);
  } finally {
    console.warn = origWarn;
    mock.setFailMode(false);
  }
});

test('fetchCatalog: cache vazio + network fail joga AitmplUnavailableError', async () => {
  mock.setFailMode(true);
  try {
    await fetchCatalog(makeOpts({ kinds: ['skills'] }));
    assert.fail('deveria ter jogado');
  } catch (e) {
    assert.ok(e instanceof AitmplUnavailableError, `esperava AitmplUnavailableError, veio ${e.name}`);
  } finally {
    mock.setFailMode(false);
  }
});
```

- [ ] **Step 5: Rodar o teste — confirma que falha (RED)**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs
```

Expected: FAIL com `Error: fetchCatalog: not implemented yet` em todos os 4 testes de fetchCatalog. Isso eh o esperado — Task 6 implementa.

- [ ] **Step 6: Commit (scaffold + RED)**

```bash
git add lib/aitmpl-client.mjs \
        tests/aitmpl-client.test.mjs \
        tests/fixtures/aitmpl/
git commit -m "test(vibecoder): aitmpl-client scaffold + mock server + testes RED de fetchCatalog"
```

---

## Task 6: Implementar `fetchCatalog` com cache (GREEN)

**Objetivo:** fazer os 4 testes de `fetchCatalog` da Task 5 passarem. Implementa fetch + cache write + cache read + TTL + stale-while-error.

**Files:**
- Modify: `lib/aitmpl-client.mjs`

- [ ] **Step 1: Confirmar que os testes ainda falham (RED ainda valido)**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchCatalog'
```

Expected: 4 FAIL com "not implemented yet".

- [ ] **Step 2: Substituir o stub de `fetchCatalog` em `lib/aitmpl-client.mjs`**

Localizar a funcao stub `export async function fetchCatalog(opts = {}) { throw ... }` e substituir por:

```javascript
import { promises as fsp } from 'node:fs';
import path from 'node:path';

// (mantenha os imports existentes — adicione os 2 acima no topo do arquivo)

const KIND_TO_PATH = (kind) => `/api/catalog/${kind}`;
const ALL_KINDS = ['skills', 'agents', 'commands', 'hooks', 'mcps', 'plugins'];

async function readCacheEntry(cacheDir, kind) {
  try {
    const file = path.join(cacheDir, `${kind}.json`);
    const meta = path.join(cacheDir, `${kind}.meta.json`);
    const [data, m] = await Promise.all([
      fsp.readFile(file, 'utf8'),
      fsp.readFile(meta, 'utf8'),
    ]);
    return { data: JSON.parse(data), meta: JSON.parse(m) };
  } catch {
    return null;
  }
}

async function writeCacheEntry(cacheDir, kind, data) {
  await fsp.mkdir(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${kind}.json`);
  const meta = path.join(cacheDir, `${kind}.meta.json`);
  await fsp.writeFile(file, JSON.stringify(data));
  await fsp.writeFile(meta, JSON.stringify({ fetched_at: Date.now() }));
}

async function fetchKindFromNetwork(baseUrl, kind) {
  const url = `${baseUrl}${KIND_TO_PATH(kind)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`network fail: ${e.message}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  let body;
  try {
    body = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new AitmplSchemaError(`expected JSON from ${url}: ${e.message}`, text.slice(0, 500));
  }
  if (!body || !Array.isArray(body.items)) {
    throw new AitmplSchemaError(
      `${url} returned shape without items[]`,
      JSON.stringify(body).slice(0, 500)
    );
  }
  return body;
}

export async function fetchCatalog(opts = {}) {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const cacheDir = opts.cacheDir || DEFAULT_CACHE_DIR;
  const ttlMs = resolveTtlMs(opts);
  const force = !!opts.force;
  const kinds = (!opts.kinds || opts.kinds.includes('all')) ? ALL_KINDS : opts.kinds;

  const items = {};
  for (const kind of kinds) {
    let cached = force ? null : await readCacheEntry(cacheDir, kind);
    const fresh = cached && (Date.now() - cached.meta.fetched_at) < ttlMs;

    if (cached && fresh) {
      items[kind] = cached.data.items;
      continue;
    }

    try {
      const body = await fetchKindFromNetwork(baseUrl, kind);
      await writeCacheEntry(cacheDir, kind, body);
      items[kind] = body.items;
    } catch (netErr) {
      if (netErr instanceof AitmplSchemaError) throw netErr;
      if (cached) {
        console.warn(`[aitmpl-client] network fail, returning stale cache for ${kind}: ${netErr.message}`);
        items[kind] = cached.data.items;
      } else {
        throw new AitmplUnavailableError(
          `aitmpl unavailable and no cache for ${kind}: ${netErr.message}`,
          netErr
        );
      }
    }
  }

  return {
    fetched_at: new Date().toISOString(),
    source: 'aitmpl.com',
    items,
  };
}
```

**Importante:** mover os 2 novos imports (`fsp`, `path`) pro TOPO do arquivo, junto com os imports existentes. Não duplicar.

- [ ] **Step 3: Rodar os testes — agora passam**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchCatalog'
```

Expected: 4 PASS. Os outros (fetchItem/search/invalidateCache) continuam FAIL com "not implemented" — esperado.

- [ ] **Step 4: Verificar que MVP segue green**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm test
```

Expected: 70 testes do MVP + 3 do schema (Task 3) + 4 de fetchCatalog = 77 PASS, **3 FAIL** (fetchItem, search, invalidateCache placeholders das proximas tasks). Esperado nesta etapa.

- [ ] **Step 5: Commit**

```bash
git add lib/aitmpl-client.mjs
git commit -m "feat(vibecoder): aitmpl-client.fetchCatalog com cache + stale-while-error"
```

---

## Task 7: Implementar `fetchItem` (RED -> GREEN)

**Objetivo:** adicionar testes pra `fetchItem` (incluindo o caso 404 -> null), depois implementar.

**Files:**
- Modify: `tests/aitmpl-client.test.mjs`
- Modify: `lib/aitmpl-client.mjs`

- [ ] **Step 1: Adicionar testes RED de fetchItem ao arquivo de teste**

Em `tests/aitmpl-client.test.mjs`, adicionar no fim (apos os testes de fetchCatalog):

```javascript
// ===== fetchItem =====

test('fetchItem: encontra item existente', async () => {
  const it = await fetchItem('skills', 'superpowers-tdd', makeOpts());
  assert.ok(it, 'deveria retornar item');
  assert.equal(it.id, 'superpowers-tdd');
  assert.equal(it.name, 'TDD');
});

test('fetchItem: retorna null em 404', async () => {
  const it = await fetchItem('skills', 'nao-existe', makeOpts());
  assert.equal(it, null);
});

test('fetchItem: erro de rede sem cache joga AitmplUnavailableError', async () => {
  mock.setFailMode(true);
  try {
    await fetchItem('skills', 'superpowers-tdd', makeOpts());
    assert.fail('deveria ter jogado');
  } catch (e) {
    assert.ok(e instanceof AitmplUnavailableError);
  } finally {
    mock.setFailMode(false);
  }
});
```

- [ ] **Step 2: Rodar — confirma RED**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchItem'
```

Expected: 3 FAIL com "not implemented".

- [ ] **Step 3: Implementar `fetchItem` em `lib/aitmpl-client.mjs`**

Substituir o stub de `fetchItem`:

```javascript
export async function fetchItem(kind, id, opts = {}) {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/item/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new AitmplUnavailableError(`fetchItem network fail: ${e.message}`, e);
  }

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new AitmplUnavailableError(`fetchItem HTTP ${res.status} from ${url}`);
  }

  try {
    return await res.json();
  } catch (e) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new AitmplSchemaError(`expected JSON from ${url}: ${e.message}`, text.slice(0, 500));
  }
}
```

- [ ] **Step 4: Rodar — agora passam**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchItem'
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/aitmpl-client.test.mjs lib/aitmpl-client.mjs
git commit -m "feat(vibecoder): aitmpl-client.fetchItem com null em 404"
```

---

## Task 8: Implementar `search` (RED -> GREEN)

**Objetivo:** busca textual no catalogo, respeitando `limit`.

**Files:**
- Modify: `tests/aitmpl-client.test.mjs`
- Modify: `lib/aitmpl-client.mjs`

- [ ] **Step 1: Adicionar testes RED de search**

Em `tests/aitmpl-client.test.mjs`, adicionar no fim:

```javascript
// ===== search =====

test('search: encontra por substring no name ou description', async () => {
  const res = await search('TDD', makeOpts());
  assert.ok(Array.isArray(res));
  assert.ok(res.some((it) => it.id === 'superpowers-tdd'));
});

test('search: respeita limit', async () => {
  const res = await search('a', makeOpts({ limit: 1 }));
  assert.equal(res.length, 1);
});

test('search: query vazia retorna lista vazia ou todos (decisao: vazia)', async () => {
  const res = await search('', makeOpts());
  assert.deepEqual(res, []);
});
```

- [ ] **Step 2: Rodar — confirma RED**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='search'
```

Expected: 3 FAIL.

- [ ] **Step 3: Implementar `search`**

Substituir o stub de `search` em `lib/aitmpl-client.mjs`:

```javascript
export async function search(query, opts = {}) {
  const q = (query || '').trim();
  if (!q) return [];

  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const limit = typeof opts.limit === 'number' ? opts.limit : 20;

  const url = `${baseUrl}/api/search?q=${encodeURIComponent(q)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new AitmplUnavailableError(`search network fail: ${e.message}`, e);
  }
  if (!res.ok) {
    throw new AitmplUnavailableError(`search HTTP ${res.status}`);
  }

  let body;
  try {
    body = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new AitmplSchemaError(`search expected JSON: ${e.message}`, text.slice(0, 500));
  }

  if (!body || !Array.isArray(body.items)) {
    throw new AitmplSchemaError('search response without items[]', JSON.stringify(body).slice(0, 500));
  }

  return body.items.slice(0, limit);
}
```

- [ ] **Step 4: Rodar — passam**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='search'
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/aitmpl-client.test.mjs lib/aitmpl-client.mjs
git commit -m "feat(vibecoder): aitmpl-client.search com limit e query vazia -> []"
```

---

## Task 9: Implementar `invalidateCache` (RED -> GREEN)

**Objetivo:** apagar cache (tudo ou por kind).

**Files:**
- Modify: `tests/aitmpl-client.test.mjs`
- Modify: `lib/aitmpl-client.mjs`

- [ ] **Step 1: Adicionar testes RED de invalidateCache**

Em `tests/aitmpl-client.test.mjs`, adicionar no fim:

```javascript
// ===== invalidateCache =====

test('invalidateCache: kind especifico apaga so aquele kind', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills', 'mcps'] }));
  await invalidateCache('skills', makeOpts());

  const skillsMeta = path.join(cacheDir, 'skills.meta.json');
  const mcpsMeta = path.join(cacheDir, 'mcps.meta.json');
  const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
  assert.equal(await exists(skillsMeta), false, 'skills.meta deveria sumir');
  assert.equal(await exists(mcpsMeta), true, 'mcps.meta deveria continuar');
});

test('invalidateCache: null apaga tudo', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills', 'mcps'] }));
  await invalidateCache(null, makeOpts());

  const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
  assert.equal(await exists(path.join(cacheDir, 'skills.meta.json')), false);
  assert.equal(await exists(path.join(cacheDir, 'mcps.meta.json')), false);
});

test('invalidateCache: cacheDir inexistente nao explode', async () => {
  await invalidateCache(null, { ...makeOpts(), cacheDir: '/tmp/tino-nao-existe-xyz-' + Date.now() });
  // sem assert — basta nao throw
});
```

- [ ] **Step 2: Rodar — RED**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs --test-name-pattern='invalidateCache'
```

Expected: 3 FAIL.

- [ ] **Step 3: Implementar `invalidateCache`**

Substituir stub de `invalidateCache` em `lib/aitmpl-client.mjs`:

```javascript
export async function invalidateCache(kind = null, opts = {}) {
  const cacheDir = opts.cacheDir || DEFAULT_CACHE_DIR;

  let entries;
  try {
    entries = await fsp.readdir(cacheDir);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }

  const targets = kind
    ? entries.filter((f) => f === `${kind}.json` || f === `${kind}.meta.json`)
    : entries.filter((f) => /\.(json|meta\.json)$/.test(f));

  await Promise.all(
    targets.map((f) => fsp.unlink(path.join(cacheDir, f)).catch(() => {}))
  );
}
```

- [ ] **Step 4: Rodar — passam**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/aitmpl-client.test.mjs
```

Expected: TODOS os testes do `aitmpl-client.test.mjs` passam (4 + 3 + 3 + 3 = 13).

- [ ] **Step 5: Commit**

```bash
git add tests/aitmpl-client.test.mjs lib/aitmpl-client.mjs
git commit -m "feat(vibecoder): aitmpl-client.invalidateCache + cierre da interface"
```

---

## Task 10: `curated-stack.yaml` + `lib/curated-stack.mjs` (parse + validate + testes)

**Objetivo:** o YAML curado com seed mínimo, o módulo que parseia e valida, e testes que garantem integridade.

**Files:**
- Create: `config/curated-stack.yaml`
- Create: `lib/curated-stack.mjs`
- Create: `tests/curated-stack.test.mjs`

- [ ] **Step 1: Escrever os testes RED primeiro**

Criar `tests/curated-stack.test.mjs`:

```javascript
// tests/curated-stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, validate } from '../lib/curated-stack.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STACK_PATH = path.join(ROOT, 'config/curated-stack.yaml');

test('parse: arquivo real eh YAML valido', () => {
  const obj = parse(STACK_PATH);
  assert.equal(obj.schema_version, 1);
  assert.ok(Array.isArray(obj.maintainers));
  assert.ok(Array.isArray(obj.essentials));
});

test('validate: arquivo real passa em todas as regras', () => {
  const obj = parse(STACK_PATH);
  const errs = validate(obj);
  assert.deepEqual(errs, [], `erros inesperados: ${JSON.stringify(errs, null, 2)}`);
});

test('validate: schema_version diferente de 1 falha', () => {
  const errs = validate({ schema_version: 2, maintainers: [], essentials: [], by_role: {}, by_plan: {}, incompatible: [] });
  assert.ok(errs.some((e) => e.includes('schema_version')));
});

test('validate: item sem campo obrigatorio falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'mcp' }], // falta install, why, source
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('install')), `esperava erro de install, vieram: ${errs}`);
  assert.ok(errs.some((e) => e.includes('why')));
  assert.ok(errs.some((e) => e.includes('source')));
});

test('validate: kind invalido falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'banana', install: 'x', why: 'x', source: 'curated' }],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('kind')));
});

test('validate: source aitmpl sem aitmpl_id falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'mcp', install: 'x', why: 'x', source: 'aitmpl' }],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('aitmpl_id')));
});

test('validate: incompatible referenciando item ausente falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'a', kind: 'mcp', install: 'x', why: 'x', source: 'curated' }],
    by_role: {},
    by_plan: {},
    incompatible: [{ items: ['a', 'fantasma'], reason: 'r' }],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('fantasma')));
});

test('validate: nomes duplicados na mesma secao falham', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [
      { name: 'a', kind: 'mcp', install: 'x', why: 'x', source: 'curated' },
      { name: 'a', kind: 'skill', install: 'y', why: 'y', source: 'curated' },
    ],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('duplicado')));
});
```

- [ ] **Step 2: Rodar — RED por arquivo ausente**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/curated-stack.test.mjs
```

Expected: FAIL — `Cannot find module '../lib/curated-stack.mjs'` ou erro no parse pq o YAML nao existe.

- [ ] **Step 3: Criar `config/curated-stack.yaml` com seed mínimo**

Criar `config/curated-stack.yaml`:

```yaml
schema_version: 1
maintainers:
  - rafael@maudibrasil.com.br
last_review: 2026-04-27

essentials:
  - name: context7
    kind: mcp
    install: "claude mcp add context7 https://mcp.context7.com/mcp"
    why: "Docs oficiais sempre atualizadas — corta alucinacao massivamente"
    source: aitmpl
    aitmpl_id: context7

by_role:
  junior:
    - name: superpowers
      kind: plugin
      install: "/plugin install superpowers"
      why: "Skills de TDD, debugging sistematico, brainstorming — evita os erros mais comuns de iniciante"
      source: aitmpl
      aitmpl_id: superpowers
  empresario:
    - name: discerna
      kind: plugin
      install: "/plugin install discerna"
      why: "Analise de conteudo — util pra empresario que cria material e precisa filtrar referencias"
      source: curated

by_plan:
  max:
    - name: epic-executor
      kind: skill
      install: "via plugin epic-executor"
      why: "Executa epics autonomos wave-a-wave — vale a pena com Opus disponivel"
      source: aitmpl
      aitmpl_id: epic-executor

incompatible: []
```

- [ ] **Step 4: Criar `lib/curated-stack.mjs`**

Criar `lib/curated-stack.mjs`:

```javascript
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
```

- [ ] **Step 5: Rodar — agora passam**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && node --test tests/curated-stack.test.mjs
```

Expected: 8 PASS.

- [ ] **Step 6: Commit**

```bash
git add config/curated-stack.yaml lib/curated-stack.mjs tests/curated-stack.test.mjs
git commit -m "feat(vibecoder): curated-stack.yaml seed + parser/validator + testes"
```

---

## Task 11: Verificação final + commit-resumo

**Objetivo:** garantir suite full green, suite `test:foundation` < 5s, doc humana coerente, deliverables checklist 100%.

**Files:** nenhum novo.

- [ ] **Step 1: Rodar suite completa**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && npm test
```

Expected: TODOS os testes (MVP 70 + schema 3 + aitmpl-client 13 + curated-stack 8 = **94 PASS**), 0 FAIL.

Se algum FAIL: **PARAR**, investigar, corrigir antes de avançar.

- [ ] **Step 2: Rodar suite focada da fundação e medir tempo**

Run:
```bash
cd /Users/rafaelmelgaco/tino-ai && time npm run test:foundation
```

Expected: 24 testes PASS em < 5s. Se demorar mais que 5s, profile o teste lento (provavelmente o de stale com `setTimeout(10)` ou setup de mock server).

- [ ] **Step 3: Ler `docs/perfil-vibecoder.md` e cruzar com schema**

Abrir lado a lado:
- `docs/perfil-vibecoder.md`
- `config/schemas/perfil-vibecoder.schema.json`

Conferir: cada campo do schema esta documentado, cada valor de enum esta listado, exemplos estao coerentes. Se divergir, atualizar o doc (nao o schema — schema eh fonte de verdade).

- [ ] **Step 4: Conferir checklist de deliverables do spec**

Abrir `docs/superpowers/specs/2026-04-27-tino-vibecoder-foundation-design.md` secao 8. Marcar mentalmente cada item:

- [x] `config/schemas/perfil-vibecoder.schema.json` validando 1 fixture válida + 2 inválidas
- [x] `config/curated-stack.yaml` populado com seed mínimo (1 essential, 2 roles, 1 plan)
- [x] `lib/aitmpl-client.mjs` com 4 funções públicas + 2 error types + cache funcional
- [x] `lib/curated-stack.mjs` com `parse()` + `validate()` exportados
- [x] `docs/perfil-vibecoder.md` documentando cada campo com exemplos
- [x] `tests/perfil-vibecoder-schema.test.mjs` green
- [x] `tests/curated-stack.test.mjs` green
- [x] `tests/aitmpl-client.test.mjs` green
- [x] `package.json` com `ajv` (e `cheerio` se Task 1 confirmou) + script `test:foundation`
- [x] `npm test` continua green
- [x] Suite `test:foundation` roda em < 5s

Se algum item nao estiver checked, voltar à task que o cobre.

- [ ] **Step 5: Commit-resumo**

```bash
git log --oneline -15
```

Conferir que existem ~10 commits da Onda 0 em sequencia. Esses commits ja documentam o que foi feito; nao eh necessario commit-resumo extra. Mas se preferir um marcador, opcional:

```bash
git commit --allow-empty -m "milestone(vibecoder): Onda 0 completa — fundacao green com 94 testes"
```

(Pular este step se nao quiser commit vazio.)

- [ ] **Step 6: Atualizar memória do projeto**

Se voce esta executando isso como agente que tem acesso à memória persistente do user, criar:

`/Users/rafaelmelgaco/.claude/projects/-Users-rafaelmelgaco-tino-ai/memory/project_tino_vibecoder_onda_0.md`:

```markdown
---
name: Tino Vibecoder Onda 0 entregue
description: Fundacao do assistente vibecoder — schema do perfil + aitmpl-client + curated-stack
type: project
---

Onda 0 do Tino vibecoder entregue em 2026-04-27. 11 tasks, ~10 commits atomicos em main, 24 novos testes (94 total green).

**Entregue:**
- `config/schemas/perfil-vibecoder.schema.json` (JSON Schema draft-07)
- `config/curated-stack.yaml` (seed: 1 essential + 2 by_role + 1 by_plan)
- `lib/aitmpl-client.mjs` (fetchCatalog, fetchItem, search, invalidateCache + cache + 2 error types)
- `lib/curated-stack.mjs` (parse + validate puros)
- `docs/perfil-vibecoder.md` (humana)

**Spec:** `docs/superpowers/specs/2026-04-27-tino-vibecoder-foundation-design.md`
**Plano executado:** `docs/superpowers/plans/2026-04-27-tino-vibecoder-foundation.md`

**Why:** fundacao compartilhada das Ondas 1 e 2. Sem isso, Setup assistido (Onda 1) e Hooks (Onda 2) duplicariam schema e cliente.

**How to apply:** quando comecar Onda 1, importar `lib/aitmpl-client.mjs` e `lib/curated-stack.mjs`; ler perfil via JSON Schema validator com `ajv`. Nao reabrir decisoes da Onda 0 sem revisar spec.
```

E adicionar linha no `MEMORY.md`:

```markdown
- [Tino Vibecoder Onda 0 entregue](project_tino_vibecoder_onda_0.md) — fundacao do assistente vibecoder (schema + aitmpl-client + curated-stack)
```

---

## Self-Review do Plano (já executado por mim antes de te entregar)

Conferi o plano contra o spec e contra o checklist da skill writing-plans:

**Spec coverage:** todas as 11 seções do spec têm task correspondente. Sec 1-2 = contexto (não geram código). Sec 3 = Tasks 1, 5-9. Sec 4 = Task 3. Sec 5 = Tasks 5-9. Sec 6 = Task 10. Sec 7 = todos os tests scattered. Sec 8 = Task 11 verifica. Sec 9 (deps) = Task 2. Sec 10-11 = riscos/próximos = covered nas decisões inline.

**Placeholders:** zero "TBD/TODO/implement later" no plano. Cada step tem código completo ou comando exato.

**Type consistency:** `fetchCatalog`/`fetchItem`/`search`/`invalidateCache` usados consistentemente em todas as tasks. `AitmplUnavailableError` e `AitmplSchemaError` definidos em Task 5, referenciados em Tasks 6/7/8/9 — coerente. Schema fields no perfil idênticos entre Task 3 (definição), Task 1-step-2 da Task 3 (fixtures), Task 4 (doc humana).

Achei UMA pequena inconsistência ao revisar: Task 6 step 4 diz "70 + 3 + 4 = 77 PASS, 3 FAIL". Vou conferir contagens:
- MVP: 70
- Task 3: 3 (perfil schema)
- Task 6: 4 (fetchCatalog) PASS + 3 stubs FAIL (fetchItem, search, invalidateCache)
- Total nessa altura: 77 PASS, 3 FAIL ✓ correto.

Final em Task 11: 70 + 3 + 13 + 8 = **94 PASS** (4 fetchCatalog + 3 fetchItem + 3 search + 3 invalidateCache = 13 aitmpl). ✓ correto.

Plano validado.
