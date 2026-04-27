# EPIC-VIBECODER0: Fundação do assistente vibecoder (Tino Onda 0)

Onda 0 de 3 da expansão do Tino — assistente do "vibe coder júnior". Esta onda entrega **infraestrutura compartilhada** (sem UI, sem comando, sem agent) que as Ondas 1 (Setup assistido) e 2 (Hooks runtime) vão consumir. Três artefatos isolados: schema do perfil + cliente do catálogo aitmpl.com + curated stack do time. Zero regressão no MVP atual de 70 testes.

## Critérios de sucesso (do user da skill, ou seja, das próximas Ondas)

1. **Schema canônico do perfil existe e valida.** `config/schemas/perfil-vibecoder.schema.json` valida fixtures válidas e rejeita inválidas (enum errado, required ausente).
2. **Cliente aitmpl.com pronto pra plugar.** `lib/aitmpl-client.mjs` expõe 4 funções (`fetchCatalog`/`fetchItem`/`search`/`invalidateCache`) + 2 error types + cache local com TTL e stale-while-error.
3. **Curated stack versionado e validado.** `config/curated-stack.yaml` com seed mínimo, validador interno, integridade de `incompatible` referenciando itens existentes.
4. **Doc humana coerente com schema.** `docs/perfil-vibecoder.md` lista cada campo e valor aceito — user pode editar à mão sem ler JSON Schema.

## Critérios de sucesso (projeto clonável)

- **Zero regressão:** os 70 testes do MVP continuam green ao fim de cada wave.
- **Suite focada rápida:** `npm run test:foundation` roda em < 5 segundos.
- **Sem deps pesadas:** apenas `ajv` (nova) + `cheerio` (condicional, decidido no spike). Tudo mais já está em `package.json`.
- **Atomic commits por wave:** cada wave fecha com 1+ commits, mensagem com prefixo `(vibecoder)` e wave id.

---

## Fases e Stories

### Fase 1: Onda 0 — Fundação

| Story | Título | Pontos | Prio | Deps | FR |
|---|---|---|---|---|---|
| F1-S01 | Spike aitmpl + deps + schema do perfil + doc humana | 5 | P0 | — | FR-VBC0-001, FR-VBC0-002 |
| F1-S02 | Aitmpl-client scaffold + fetchCatalog com cache | 5 | P0 | F1-S01 | FR-VBC0-003 |
| F1-S03 | Aitmpl-client fetchItem + search + invalidateCache | 5 | P0 | F1-S02 | FR-VBC0-003 |
| F1-S04 | Curated-stack YAML + parser/validator + verificação final | 5 | P0 | F1-S03 | FR-VBC0-004 |

---

## Requisitos funcionais (FR)

- **FR-VBC0-001** — `package.json` ganha `ajv` (e `cheerio` se spike confirmar HTML scraping no aitmpl.com), além do script `npm run test:foundation`. Spike documentado em `docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md`.

- **FR-VBC0-002** — `config/schemas/perfil-vibecoder.schema.json` (JSON Schema draft-07) valida o frontmatter de `Tino/_perfil-vibecoder.md`. Campos obrigatórios: `schema_version`, `papel`, `experiencia_dev`, `plano_claude`, `sistema`, `tipo_projeto`, `modo_autonomia`, `tolerancia_risco`, `intervencao_hooks`. Doc humana em `docs/perfil-vibecoder.md` lista cada campo + valores aceitos + exemplo. Testes em `tests/perfil-vibecoder-schema.test.mjs` com 3 fixtures (válida + bad-enum + missing-required).

- **FR-VBC0-003** — `lib/aitmpl-client.mjs` expõe `fetchCatalog(opts)`, `fetchItem(kind, id, opts)`, `search(query, opts)`, `invalidateCache(kind, opts)` + classes `AitmplUnavailableError` e `AitmplSchemaError`. Cache local em `.tino-cache/aitmpl/` com TTL (24h padrão, configurável via `TINO_AITMPL_TTL`). Stale-while-error: se network falha mas cache existe, retorna stale com `console.warn`. Sem cache + network fail → throw `AitmplUnavailableError`. `fetchItem` retorna `null` em 404 (não throw). Testes em `tests/aitmpl-client.test.mjs` com mock HTTP server local (`tests/fixtures/aitmpl/mock-server.mjs`) — 13 cases cobrindo cache hit/miss/stale + erros + edge cases.

- **FR-VBC0-004** — `config/curated-stack.yaml` (seed mínimo: 1 essential + 2 by_role + 1 by_plan), validado por `lib/curated-stack.mjs::validate(obj)`. Validações: `schema_version: 1`, 5 campos obrigatórios por item (`name`, `kind`, `install`, `why`, `source`), enum em `kind` e `source`, `aitmpl_id` obrigatório quando `source: aitmpl`, nomes únicos por seção, `incompatible.items[*]` referenciam nomes existentes. Testes em `tests/curated-stack.test.mjs` com 8 casos.

---

## Arquitetura

- **Tipo de wave:** infra-only — sem UI, sem servidor, sem agent. Gate de QA é `npm test`, não Playwright.
- **Linguagem/stack:** Node.js 20+, ESM puro (`.mjs`), `node:test` nativo, `node:assert/strict`.
- **Deps:** `yaml` (já em `package.json`), `ajv` (nova), `cheerio` (condicional ao spike).
- **Cache:** `.tino-cache/aitmpl/` espelhando o padrão `.tino-cache/` que já existe no MVP.
- **Boundary explícito:** zero `.claude/commands/`, zero `.claude/agents/`, zero `.claude/skills/`, zero CLI nesta onda. Tudo é biblioteca + config + schema + teste.
- **Spec de referência:** `docs/superpowers/specs/2026-04-27-tino-vibecoder-foundation-design.md`
- **Plano executável:** `docs/superpowers/plans/2026-04-27-tino-vibecoder-foundation.md`

### Contracts expostos (para Onda 1 e Onda 2)

- **Filesystem:** `Tino/_perfil-vibecoder.md` — schema canônico do perfil vibecoder no vault do user.
- **Module:** `lib/aitmpl-client.mjs` — API: `fetchCatalog`, `fetchItem`, `search`, `invalidateCache`, `AitmplUnavailableError`, `AitmplSchemaError`.
- **Module:** `lib/curated-stack.mjs` — API: `parse(filePath)`, `validate(obj)`.
- **Config:** `config/schemas/perfil-vibecoder.schema.json` — JSON Schema draft-07.
- **Config:** `config/curated-stack.yaml` — stack curado standalone, segmentado por perfil.

### Decisões fixadas (não reabrir sem revisar spec)

- `_perfil-vibecoder.md` é arquivo **separado** do `_perfil.md` (paralelo, não substitui).
- aitmpl-client é **standalone**; web research geral fica ad-hoc na Onda 1.
- Curated-stack é **standalone segmentado por perfil**, não referência ao aitmpl. Sobrevive ao aitmpl sair do ar.
- Onda 0 entrega só **biblioteca + config + schema + teste** — zero código que LÊ o perfil ou CHAMA o client em fluxo real (isso é Onda 1).

---

## Wave-by-wave testable criteria

### F1-S01 (Wave 1)
1. **Given** `npm install`, **Then** `package.json.dependencies.ajv` existe.
2. **Given** `npm run test:foundation`, **Then** o script existe e tenta rodar (pode falhar nesta wave porque outros arquivos ainda não existem — esperado).
3. **Given** `node --test tests/perfil-vibecoder-schema.test.mjs`, **Then** 3 testes PASS.
4. **Given** `npm test`, **Then** 70 (MVP) + 3 (schema) = 73 PASS, 0 FAIL.
5. **Given** `docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md`, **Then** existe e documenta decisão sobre formato do aitmpl.com.
6. **Given** `docs/perfil-vibecoder.md`, **Then** cada campo do schema está documentado com valores aceitos.
7. **Given** `git log`, **Then** ≥ 3 commits desta wave com prefixo `(vibecoder)`.

### F1-S02 (Wave 2)
1. **Given** scaffold de `lib/aitmpl-client.mjs`, **Then** exporta `fetchCatalog`, `fetchItem`, `search`, `invalidateCache`, `AitmplUnavailableError`, `AitmplSchemaError`.
2. **Given** mock server em `tests/fixtures/aitmpl/mock-server.mjs`, **Then** sobe em porta efêmera e responde fixtures.
3. **Given** `node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchCatalog'`, **Then** 4 testes PASS (cache hit, cache stale + warning, sem cache + fail → AitmplUnavailableError, fetch fresh).
4. **Given** `npm test`, **Then** 73 + 4 = 77 PASS + 3 FAIL (stubs de fetchItem/search/invalidateCache, esperado nesta etapa).

### F1-S03 (Wave 3)
1. **Given** `node --test tests/aitmpl-client.test.mjs --test-name-pattern='fetchItem'`, **Then** 3 testes PASS (item existente, 404 → null, network fail → AitmplUnavailableError).
2. **Given** `node --test tests/aitmpl-client.test.mjs --test-name-pattern='search'`, **Then** 3 testes PASS (encontra por substring, respeita limit, query vazia → []).
3. **Given** `node --test tests/aitmpl-client.test.mjs --test-name-pattern='invalidateCache'`, **Then** 3 testes PASS (kind específico, null = tudo, dir inexistente não explode).
4. **Given** `npm test`, **Then** 70 + 3 + 13 = 86 PASS, 0 FAIL.

### F1-S04 (Wave 4)
1. **Given** `node --test tests/curated-stack.test.mjs`, **Then** 8 testes PASS.
2. **Given** `config/curated-stack.yaml`, **Then** parseia e valida com 0 erros.
3. **Given** `npm test`, **Then** **94 PASS, 0 FAIL** (70 MVP + 24 vibecoder = 94).
4. **Given** `npm run test:foundation`, **Then** roda em < 5s.
5. **Given** `docs/perfil-vibecoder.md` cruzado com `config/schemas/perfil-vibecoder.schema.json`, **Then** todos os campos batem (sem divergência).
