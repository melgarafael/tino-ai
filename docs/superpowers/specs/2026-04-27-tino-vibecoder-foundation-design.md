# Tino Vibecoder — Onda 0: Fundação

**Data:** 2026-04-27
**Status:** Draft (aguardando review do user)
**Escopo:** Onda 0 de 3 (Fundação → Setup assistido → Assistente runtime)
**Próximo passo após aprovação:** invocar skill `writing-plans` pra gerar plano de implementação

---

## 1. Contexto

O Tino atual (MVP entregue 2026-04-21) é um **curador local-first de novidades de IA** — lê fontes, escreve novidades ranqueadas no vault Obsidian do user. 70 testes green, 8 waves do epic-executor, sólido.

A próxima evolução é uma **expansão de natureza**: Tino deixa de ser apenas curador de novidades e passa a ser um **assistente completo do "vibe coder júnior"** — alguém que começou a usar Claude Code recentemente, não passou pela bolha de erros que devs experientes já viveram, e portanto não desenvolveu instinto pra:

- Escrever prompts com especificação suficiente
- Configurar `CLAUDE.md`, hooks, permissions com critério
- Escolher quais skills/agents/MCPs/plugins instalar
- Reconhecer quando está entrando em loop de erro

Essa expansão se decompõe em **3 ondas**:

| Onda | Entregável | Status |
|------|-----------|--------|
| **0 — Fundação** | Schema do perfil + cliente aitmpl.com + curated-stack | **Este documento** |
| 1 — Setup assistido | `/tino:vibe-setup` + `/tino:vibe-stack` + `/tino:vibe-install` | Próximo brainstorm |
| 2 — Assistente runtime | Hooks anti-preguiçoso + anti-burro + output visual | Brainstorm futuro |

Esta Onda 0 entrega **infraestrutura compartilhada**: contratos, schemas e código reusável que as Ondas 1 e 2 vão consumir. **Não tem usuário final** — quem consome são as próximas ondas.

---

## 2. Goals e Non-Goals

### Goals

- Definir formato canônico de `Tino/_perfil-vibecoder.md` (frontmatter + body)
- Entregar `lib/aitmpl-client.mjs` testado: fetch + cache + error handling
- Entregar `config/curated-stack.yaml` com schema validável e conteúdo inicial mínimo
- Tudo verificável com `node:test` rodando em < 5s
- Zero regressão no MVP atual (70 testes continuam green)

### Non-Goals (o que NÃO entregamos nesta onda)

- Comando `.claude/commands/tino-vibe-setup.md` (Onda 1)
- Agent que conduz a triagem (Onda 1)
- Lógica que combina perfil + curated + aitmpl pra recomendar (Onda 1)
- Qualquer hook em `.claude/hooks/` ou `~/.claude/settings.json` (Onda 2)
- Módulo de research web genérico (decidido: faz ad-hoc na Onda 1)
- Conteúdo "completo" do `curated-stack.yaml` — só seed inicial (1 essential + 1 por role + 1 por plan)

---

## 3. Arquitetura e layout de arquivos

```
tino-ai/
├── config/
│   ├── curated-stack.yaml                     ← NOVO
│   └── schemas/
│       └── perfil-vibecoder.schema.json       ← NOVO
├── lib/
│   ├── aitmpl-client.mjs                      ← NOVO
│   └── curated-stack.mjs                      ← NOVO (parser + validator interno)
├── docs/
│   └── perfil-vibecoder.md                    ← NOVO (doc humana do schema)
├── tests/
│   ├── aitmpl-client.test.mjs                 ← NOVO
│   ├── curated-stack.test.mjs                 ← NOVO
│   ├── perfil-vibecoder-schema.test.mjs       ← NOVO
│   └── fixtures/
│       ├── aitmpl/                            ← NOVO (mock responses)
│       └── perfil-vibecoder-{valid,bad-enum,missing-required}.md ← NOVO
└── package.json                               ← UPDATE (adicionar `ajv`, script test:foundation)
```

### Convenções herdadas (não reinventar)

- ESM puro (`.mjs`), `node:test` nativo (não jest/vitest)
- `yaml` já está instalado (usado por `lib/vault-scanner.mjs`)
- Cache em `.tino-cache/` (já existe pro fetcher de novidades)
- `package.json` scripts seguem padrão `test:*`

### Boundary explícito

- Zero `.claude/commands/`, zero `.claude/agents/`, zero `.claude/skills/` nesta onda
- Zero código que **lê** o perfil do user — só **define o formato**
- Zero código que **chama** o aitmpl-client em fluxo real — só o módulo + testes
- Zero CLI/script novo. Tudo é biblioteca + config + schema + teste

---

## 4. Schema: `Tino/_perfil-vibecoder.md`

### 4.1 Localização

Arquivo separado em `{vault}/Tino/_perfil-vibecoder.md`, **paralelo** ao `_perfil.md` existente. Razões:
- Zero risco pro MVP atual (`profile-extractor` agent intocado, `lib/frontmatter.mjs` intocado)
- Schemas com responsabilidades distintas: `_perfil.md` = personalização de curadoria de novidades; `_perfil-vibecoder.md` = perfil de uso do Claude Code
- Migração trivial pra unificar depois se fizer sentido; o caminho contrário (separar depois) é doloroso

### 4.2 Frontmatter (machine-readable)

```yaml
---
schema_version: 1
created_at: 2026-04-27T14:30:00Z
updated_at: 2026-04-27T14:30:00Z

# Identidade
nome: "Rafael"
papel: "empresario"           # junior | pleno | senior | empresario | curioso | educador
experiencia_dev: "iniciante"  # nenhuma | iniciante | intermediario | avancado

# Plano e recursos
plano_claude: "max"           # free | pro | max | api | desconhecido
orcamento_tokens: "moderado"  # economico | moderado | generoso

# Stack atual
sistema: "darwin"             # darwin | linux | windows
linguagens_familiares:        # array of string (free-form, lowercase)
  - javascript
  - python
stacks_conhecidas:            # array of string
  - nextjs
  - react

# Intenção
tipo_projeto:                 # array; pelo menos 1 item
  - webapp
  - saas
  # valores aceitos: webapp | mobile | cli | automacao | conteudo | saas | ferramenta-interna | outro
objetivos_curto_prazo: "..."  # 1-2 frases narrativas

# Comportamento Claude Code
modo_autonomia: "balanceado"     # perguntativo | balanceado | autonomo
tolerancia_risco: "media"        # baixa | media | alta
intervencao_hooks: "ativa"       # silenciosa | ativa | agressiva

# Inventário (preenchido na triagem; vazio = setup zero)
ja_tem_instalado:
  skills: []
  agents: []
  mcps: []
  plugins: []
  hooks: []
---
```

**Razões de design:**
- `schema_version: 1` no topo permite migração futura sem quebrar parsers
- `papel` separado de `experiencia_dev` — empresário pode ser ex-engenheiro OU zero técnico; capturar separado evita inferência ruim
- `orcamento_tokens` separado de `plano_claude` — alguém no Max pode querer modo econômico por princípio
- `intervencao_hooks` separado de `modo_autonomia` — combinações como "autônomo + intervenção agressiva" são coerentes (faz mais sozinho mas com mais salvaguardas)
- `ja_tem_instalado` evita Tino sugerir o que o user já tem — fundamental pra UX

### 4.3 Body (markdown livre)

```markdown
## O que mais importa pra você agora
[narrativa coletada na triagem da Onda 1]

## O que você quer evitar
[anti-padrões, dores passadas]

## Notas do Tino
[seção que o Tino atualiza ao longo do tempo — observações de uso]
```

### 4.4 JSON Schema

`config/schemas/perfil-vibecoder.schema.json` em draft-07. Validador: `ajv` (rock-solid, ~30kb, padrão da indústria).

Campos obrigatórios: `schema_version`, `papel`, `experiencia_dev`, `plano_claude`, `sistema`, `tipo_projeto`, `modo_autonomia`, `tolerancia_risco`, `intervencao_hooks`. Tudo mais opcional (triagem pode ser parcial).

### 4.5 Doc humana

`docs/perfil-vibecoder.md`: cada campo + valores aceitos + exemplo realista. Vira referência pro próprio user revisar/editar manualmente sem precisar abrir JSON Schema.

---

## 5. Módulo: `lib/aitmpl-client.mjs`

### 5.1 Interface pública

```javascript
// Busca catálogo (skills, agents, commands, hooks, mcps, plugins)
fetchCatalog({ kinds = ['all'], force = false }) → Catalog

// Busca item específico
fetchItem(kind, id, { force = false }) → Item | null

// Busca textual no catálogo
search(query, { kinds = ['all'], limit = 20 }) → Item[]

// Invalida cache
invalidateCache(kind = null) → void  // null = tudo
```

**Tipos** (esboço — schema concreto é descoberto no spike inicial):

```javascript
Catalog = {
  fetched_at: string,           // ISO timestamp
  source: "aitmpl.com",
  items: { skills: Item[], agents: Item[], commands: Item[], hooks: Item[], mcps: Item[], plugins: Item[] }
}

Item = {
  id: string,                   // identifier estável do aitmpl
  name: string,
  kind: "skill"|"agent"|"command"|"hook"|"mcp"|"plugin",
  description: string,
  install: string?,             // comando ou link
  ...                           // campos extras preservados como vieram
}
```

### 5.2 Cache

- Local: `.tino-cache/aitmpl/{kind}.json` + `.tino-cache/aitmpl/_meta.json` (timestamps)
- TTL padrão: 24h. Configurável via env `TINO_AITMPL_TTL` (segundos)
- `force: true` bypassa cache
- Stale-while-error: se network falha mas cache existe (mesmo expirado), retorna stale com warning no stderr

### 5.3 Error handling

| Cenário | Comportamento |
|---|---|
| Network OK | Cacheia + retorna fresh |
| Network fail + cache fresh | Retorna cache, sem warning |
| Network fail + cache stale | Retorna stale + `console.warn` |
| Network fail + cache vazio | `throw AitmplUnavailableError` |
| Schema parsing fail | `throw AitmplSchemaError` com sample do que veio |
| 404 em `fetchItem` | Retorna `null` (não throw) |

### 5.4 Decisões-chave

- **Retorna `null` em 404** ao invés de throw — caller decide se ausência é erro
- **Errors customizados** (`AitmplUnavailableError`, `AitmplSchemaError`) — caller pode `instanceof` pra recovery diferenciado
- **Cache JSON cru, sem normalização** — se aitmpl mudar formato, falha é visível na próxima leitura, não silenciosa
- **Sem retry automático** — política de retry é decisão do caller (Onda 1 pode querer 3 tries com backoff; hooks da Onda 2 podem querer fail-fast)

### 5.5 Premissa a validar na implementação

aitmpl.com expõe API JSON ou só HTML? Se HTML, parsear com `cheerio` (~50kb, leve, padrão).
**Spike obrigatório no início da Wave de implementação:** `curl https://aitmpl.com` + verificar se há `/api/*` ou `application/json` em alguma rota. Se for só HTML, adicionar `cheerio` à lista de deps.

---

## 6. Config: `config/curated-stack.yaml`

### 6.1 Estrutura

```yaml
schema_version: 1
maintainers:
  - rafael@maudibrasil.com.br
last_review: 2026-04-27

# Cada item tem 5 campos obrigatórios:
#   name (string, único na seção), kind (skill|agent|command|hook|mcp|plugin),
#   install (string com cmd ou link), why (string, 1 linha),
#   source (curated|aitmpl|repo), aitmpl_id (string, opcional)

essentials:
  # Recebe SEMPRE, independente de perfil
  - name: context7
    kind: mcp
    install: "claude mcp add context7 https://mcp.context7.com/mcp"
    why: "Docs oficiais sempre atualizadas — corta alucinação massivamente"
    source: aitmpl
    aitmpl_id: context7

by_role:
  junior:
    - name: superpowers
      kind: plugin
      install: "/plugin install superpowers"
      why: "Skills de TDD, debugging sistemático, brainstorming — evita os erros mais comuns de iniciante"
      source: aitmpl
  empresario:
    - name: discerna
      kind: plugin
      install: "/plugin install discerna"
      why: "Análise de conteúdo — útil pra empresário que cria material e precisa filtrar referências"
      source: curated

by_plan:
  free:
    # placeholder — popular conforme curadoria
  max:
    - name: epic-executor
      kind: skill
      install: "via plugin epic-executor"
      why: "Executa epics autônomos wave-a-wave — vale a pena com Opus disponível"
      source: aitmpl

incompatible:
  # Pares conhecidos por conflitar — checado antes de instalar na Onda 1
  # Formato: { items: [name1, name2], reason: string }
  []
```

### 6.2 Validação

Em `lib/curated-stack.mjs::validate(yamlObj)`. Funções puras, sem dep externa de schema validator (yaml já carregado, validação é só checar shape):

- `schema_version` deve ser `1`
- Cada item deve ter os 5 campos obrigatórios
- `kind` ∈ enum
- `source` ∈ enum
- Nomes únicos dentro da mesma seção (`essentials`, `by_role.X`, `by_plan.Y`)
- `incompatible.items` referenciam nomes existentes em alguma seção
- Se `source: aitmpl`, `aitmpl_id` é obrigatório

Test garante que `config/curated-stack.yaml` real passa.

### 6.3 Decisões-chave

- **`source` em cada item** — rastreabilidade: "isso veio do aitmpl ou foi curado pelo time?" importa pra debug e crédito
- **`aitmpl_id` opcional** — quando presente, Onda 1 pode hidratar metadados extras via `aitmpl-client`
- **`by_role` e `by_plan` são listas paralelas, não exclusivas** — Onda 1 vai concatenar (essentials + by_role[X] + by_plan[Y]) e dedupe por `name`
- **`incompatible` é checado na Onda 1** antes de instalar — Onda 0 só armazena
- **Conteúdo inicial mínimo:** 1 essential, 1-2 por role, 1-2 por plan. Resto é populado depois pelo time conforme uso real. Não inventar 50 itens fictícios

---

## 7. Estratégia de testes

### 7.1 Padrão herdado

`node:test` nativo, `node --test tests/*.test.mjs`, fixtures em `tests/fixtures/`.

### 7.2 Arquivos

| Arquivo | O que testa | Tipo |
|---|---|---|
| `tests/perfil-vibecoder-schema.test.mjs` | Fixture `valid.md` passa; fixtures `bad-enum.md` e `missing-required.md` são rejeitadas com mensagem útil | Schema validation |
| `tests/curated-stack.test.mjs` | `config/curated-stack.yaml` real parseia; cada item tem 5 campos obrigatórios; nenhum `incompatible` referencia item ausente; nenhum `aitmpl_id` duplicado entre seções | Contract |
| `tests/aitmpl-client.test.mjs` | Cache hit/miss/stale; error types corretos; `fetchItem` retorna `null` em 404; `search` respeita `limit`; stale-while-error funciona | Unit + integration com mock HTTP |

### 7.3 Mock HTTP

Servidor `node:http` local levantado em `before()` cada teste, fixtures em `tests/fixtures/aitmpl/{kind}.json`. Sem nock/msw (zero deps novas).

### 7.4 Coverage e performance

- Coverage alvo: 80%+ em `lib/aitmpl-client.mjs`
- Schema/contract tests são all-or-nothing por natureza
- Suite total da Onda 0 deve rodar em < 5s
- Sem E2E nesta onda (não tem fluxo end-to-end ainda)

---

## 8. Deliverables checklist

Onda 0 está pronta quando:

- [ ] `config/schemas/perfil-vibecoder.schema.json` validando 1 fixture válida + 2 inválidas
- [ ] `config/curated-stack.yaml` populado com seed mínimo (1 essential, 2 roles, 1 plan)
- [ ] `lib/aitmpl-client.mjs` com 4 funções públicas + 2 error types + cache funcional
- [ ] `lib/curated-stack.mjs` com `parse()` + `validate()` exportados
- [ ] `docs/perfil-vibecoder.md` documentando cada campo com exemplos
- [ ] `tests/perfil-vibecoder-schema.test.mjs` green
- [ ] `tests/curated-stack.test.mjs` green
- [ ] `tests/aitmpl-client.test.mjs` green
- [ ] `package.json` com `ajv` (e `cheerio` se spike confirmar HTML scraping) + script `test:foundation`
- [ ] `npm run test` continua green (70 testes do MVP + novos)
- [ ] Suite `test:foundation` roda em < 5s
- [ ] Commit atômico em `main`

---

## 9. Dependências novas

- **`ajv`** (~30kb) — JSON Schema validator. Padrão da indústria, sem alternativa razoável.
- **`cheerio`** (~50kb) — apenas se spike confirmar que aitmpl.com não expõe JSON. Decisão na Wave de implementação.

Nenhuma outra. `yaml` (já em `package.json`) e `node:http` já estão disponíveis.

---

## 10. Riscos e questões abertas

### Risco 1: aitmpl.com pode não ter API estável

**Mitigação:** spike no início da implementação. Se for só HTML scraping, fechamos versão de schema do response no client (`AitmplSchemaError` cobre mudanças). Se for catastrofico (site sai do ar), curated-stack continua funcionando standalone — Tino degrada com graça.

### Risco 2: schema do perfil pode ficar pequeno demais

Se na Onda 1 a triagem descobrir que precisamos de mais 2-3 campos, bumpamos `schema_version: 2` e adicionamos. Versionamento já desenhado pra isso.

### Risco 3: curated-stack pode envelhecer

Conteúdo inicial é seed mínimo de propósito — qualidade > quantidade. Time mantém via PR/commit, não via UI. Risco aceito; é o ponto de curadoria.

### Questão aberta 1: aitmpl.com está vivo e o que expõe?

Será resolvida no spike inicial da implementação (tarefa explícita no plano).

### Questão aberta 2: como o user vai EDITAR o `_perfil-vibecoder.md` manualmente?

Doc humana em `docs/perfil-vibecoder.md` cobre o "como editar". Atalho/comando do tipo `/tino:vibe-profile-edit` é Onda 1, não Onda 0.

---

## 11. Próximo passo

Após aprovação deste spec, transição pra skill `writing-plans` que vai produzir um plano de implementação executável (provavelmente 4-5 waves: spike aitmpl → schema perfil → aitmpl-client → curated-stack → docs+integração final).

A execução do plano usa `epic-executor` no padrão já validado (8/8 waves do MVP em 2026-04-21).
