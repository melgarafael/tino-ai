# Tino Vibecoder — Onda 1: Setup Assistido

**Data:** 2026-04-27
**Status:** Draft (aguardando review do user)
**Escopo:** Onda 1 de 3 (Fundação → **Setup assistido** → Hooks runtime)
**Próximo passo após aprovação:** invocar skill `writing-plans` pra gerar plano de implementação

---

## 1. Contexto

A Onda 0 (entregue 2026-04-27, 87 testes green) deixou pronta a infraestrutura compartilhada: schema do `_perfil-vibecoder.md`, cliente do `aitmpl.com` (`/components.json`), e `curated-stack.yaml` validado. Agora a Onda 1 transforma essa infraestrutura em **experiência de uso** pro vibe coder júnior: triagem → recomendação → instalação → CLAUDE.md customizado.

A Onda 2 (futura) virá em cima disso com hooks runtime que dependem do `_perfil-vibecoder.md` calibrado pela Onda 1 (`modo_autonomia`, `intervencao_hooks`).

**Decisão de UX (aprovada no brainstorm):** wizard único `/tino:vibe-onboard` como porta padrão + 3 escape hatches (`/tino:vibe-setup`, `/tino:vibe-stack`, `/tino:vibe-install`) pra rodar partes específicas depois. Júnior usa o wizard. User experiente usa os comandos individuais quando quer atualizar só uma parte.

---

## 2. Goals e Non-Goals

### Goals

- Entregar 4 comandos `.claude/commands/tino-vibe-*.md` funcionais
- Entregar 3 agents `.claude/agents/vibecoder-*.md`
- Entregar 5 lib modules puros e testados (`stack-resolver`, `recomendacao-render`, `claude-md-template`, `settings-patch`, `install-sh-render`)
- Triagem produz `Tino/_perfil-vibecoder.md` válido contra schema da Onda 0
- Recomendação produz `Tino/_recomendacao.md` legível pelo user antes do install
- Install gera `{project-root}/CLAUDE.md` customizado + `{vault}/Tino/_install.sh` + opcionalmente patch de `~/.claude/settings.json`
- Comportamento de install **derivado de `perfil.modo_autonomia`** — não de flags
- Zero regressão (87 testes green continuam green)
- Suite total ainda em < 10s (Onda 0 estava em ~2s, podemos subir um pouco)

### Non-Goals

- Hooks anti-preguiçoso/anti-burro (Onda 2)
- Output visual estilizado no terminal além do que Claude Code já faz (Onda 2)
- Editar CLAUDE.md global em `~/.claude/CLAUDE.md` (somente project-root nesta onda)
- Quarkdown ou outros tools opcionais mencionados no vision original (deferred — adicionável depois ao curated-stack.yaml)
- Re-instalação inteligente (detectar se item já estava instalado e atualizar) — esta onda só INSTALA o que falta
- Web research engine (decisão de Onda 0 foi: ad-hoc na Onda 1; ainda válida — `aitmpl-client` cobre 80%, web research direto via WebSearch fica por conta do agent quando precisar)

---

## 3. Arquitetura e layout de arquivos

```
tino-ai/
├── .claude/
│   ├── commands/
│   │   ├── tino-vibe-onboard.md            NEW (wizard)
│   │   ├── tino-vibe-setup.md              NEW (triagem)
│   │   ├── tino-vibe-stack.md              NEW (recomendação)
│   │   └── tino-vibe-install.md            NEW (instalação)
│   └── agents/
│       ├── vibecoder-interviewer.md        NEW
│       ├── vibecoder-recommender.md        NEW
│       └── vibecoder-installer.md          NEW
├── config/
│   └── schemas/
│       └── recomendacao.schema.json        NEW
├── lib/
│   ├── stack-resolver.mjs                  NEW
│   ├── recomendacao-render.mjs             NEW
│   ├── claude-md-template.mjs              NEW
│   ├── settings-patch.mjs                  NEW
│   └── install-sh-render.mjs               NEW
├── tests/
│   ├── stack-resolver.test.mjs             NEW
│   ├── recomendacao-render.test.mjs        NEW
│   ├── claude-md-template.test.mjs         NEW
│   ├── settings-patch.test.mjs             NEW
│   ├── install-sh-render.test.mjs          NEW
│   └── recomendacao-schema.test.mjs        NEW
├── docs/
│   ├── perfil-vibecoder.md                 (Onda 0)
│   └── recomendacao-vibecoder.md           NEW (doc humana do schema)
└── package.json                            UPDATE (script test:setup)
```

13 arquivos novos + atualização leve do `package.json`. Tudo em ESM puro `.mjs`, `node:test` nativo, `node:assert/strict`. Mantém convenção do MVP e Onda 0.

### Boundary explícito

- Comandos `.claude/commands/tino-vibe-*` chamam agents — nunca implementam lógica de negócio direta
- Agents leem perfil/recomendação e delegam **toda** computação determinística pros lib modules
- Lib modules são puros — sem side effects além do que sua assinatura promete (`render`, `resolve`, `patch`)
- Side effects (escrever arquivo, executar shell) ficam no agent, não no lib
- Zero modificação de código da Onda 0 ou MVP

---

## 4. Comandos

### 4.1 `/tino:vibe-onboard` — wizard

Usage: `/tino:vibe-onboard {vault-path}`

Sequência:
1. Confirma vault-path (auto-detecta de `~/.tino/config.sh` se omitido — herda padrão MVP)
2. Chama `/tino:vibe-setup {vault-path}` — triagem completa
3. Mostra resumo do perfil gerado, pergunta "Continuar pra recomendação?"
4. Chama `/tino:vibe-stack {vault-path}` — gera `_recomendacao.md`
5. Mostra resumo da recomendação, pergunta "Continuar pra instalação?"
6. Chama `/tino:vibe-install {vault-path}` — aplica config conforme `modo_autonomia`
7. Resumo final: o que foi feito + próximos passos sugeridos

Implementação: comando `.md` que descreve a sequência pra o Claude orquestrar via menções aos outros comandos. Sem código JS de orquestração — Claude entende a sequência. YAGNI.

### 4.2 `/tino:vibe-setup` — triagem

Usage: `/tino:vibe-setup {vault-path} [--re-run]`

Comportamento:
- Verifica se `{vault-path}/Tino/_perfil-vibecoder.md` já existe. Se sim e `--re-run` não foi passado, mostra perfil atual + pergunta "atualizar?" Se `--re-run`, sobrescreve sem perguntar.
- Lê `{vault-path}/Tino/_perfil.md` (do MVP) pra extrair sinais sobre stack atual do user (otimiza UX da triagem — não pergunta de novo o que já dá pra inferir)
- Invoca agent `vibecoder-interviewer` que conduz entrevista
- Agent valida cada resposta contra o JSON Schema da Onda 0 antes de gravar
- Auto-detecta: `sistema` (via `process.platform`), `ja_tem_instalado.skills/agents/mcps/plugins/hooks` (via shell scan de `~/.claude/`)
- Pergunta ao user os campos NÃO auto-detectáveis
- Escreve `{vault-path}/Tino/_perfil-vibecoder.md` (frontmatter + 3 seções body)

### 4.3 `/tino:vibe-stack` — recomendação

Usage: `/tino:vibe-stack {vault-path}`

Comportamento:
- Lê `{vault-path}/Tino/_perfil-vibecoder.md` (falha gracioso se não existe — sugere rodar `/tino:vibe-setup` antes)
- Carrega `config/curated-stack.yaml` via `lib/curated-stack.mjs` (Onda 0)
- Invoca agent `vibecoder-recommender` que:
  1. Chama `lib/stack-resolver.mjs::resolve(perfil, curatedStack)` → lista base
  2. Opcionalmente busca extras via `lib/aitmpl-client.mjs::search()` baseado em `perfil.linguagens_familiares` + `tipo_projeto` (3-5 sugestões)
  3. Renderiza via `lib/recomendacao-render.mjs::render(items, perfil)` → markdown completo
  4. Escreve `{vault-path}/Tino/_recomendacao.md`

### 4.4 `/tino:vibe-install` — instalação

Usage: `/tino:vibe-install {vault-path} [--project-root <dir>]`

Comportamento:
- Lê `{vault-path}/Tino/_perfil-vibecoder.md` + `_recomendacao.md` (falha gracioso se faltar)
- `--project-root` default = `process.cwd()`
- Invoca agent `vibecoder-installer` que:
  1. Renderiza CLAUDE.md via `lib/claude-md-template.mjs::render(perfil)` → escreve em `{project-root}/CLAUDE.md` (com prompt de overwrite se já existe — backup `.tino-bak.<ISO>`)
  2. Renderiza `_install.sh` via `lib/install-sh-render.mjs::render(items)` → escreve em `{vault-path}/Tino/_install.sh` (chmod +x)
  3. Calcula patch de `~/.claude/settings.json` via `lib/settings-patch.mjs::computePatch(perfil)` → mostra diff ao user. **SEMPRE pergunta OK explicitamente** — esta é a única ação que ignora `modo_autonomia: autonomo` (segurança de settings global é sagrada)
  4. Se user OK no patch: aplica com backup `~/.claude/settings.json.tino-bak.<ISO>`
  5. Executa `_install.sh` baseado em `perfil.modo_autonomia`:
     - `perguntativo`: roda `bash _install.sh --interactive` (pergunta por item — flag implementada no script gerado)
     - `balanceado`: mostra script, pergunta "executar tudo?"; se OK roda
     - `autonomo`: executa direto, mostrando saída em tempo real

---

## 5. Agents

### 5.1 `vibecoder-interviewer`

**Persona:** entrevistador empático, técnico, faz uma pergunta por vez, não despeja questionário.

**Inputs:** vault-path, perfil-md-do-MVP-se-existir
**Output:** `_perfil-vibecoder.md` válido contra schema da Onda 0

**Sequência interna:**
1. Auto-detect: sistema (`uname -s`), `ja_tem_instalado` (`ls ~/.claude/skills`, `ls ~/.claude/agents`, etc — campos vazios `[]` se ausentes)
2. Pergunta `nome` — opcional, pode pular
3. Pergunta `papel` (multiple choice 6 opções)
4. Pergunta `experiencia_dev` (mc 4 opções)
5. Pergunta `plano_claude` (mc 5 opções)
6. Pergunta `orcamento_tokens` (mc 3 opções, default sugerido baseado no plano)
7. Pergunta `linguagens_familiares` (input livre, parseia vírgula → array lowercase)
8. Pergunta `stacks_conhecidas` (input livre, idem)
9. Pergunta `tipo_projeto` (mc multi-select 8 opções, mín 1)
10. Pergunta `objetivos_curto_prazo` (texto livre 1-2 frases)
11. Pergunta `modo_autonomia` (mc 3 opções, com explicação de cada)
12. Pergunta `tolerancia_risco` (mc 3 opções)
13. Pergunta `intervencao_hooks` (mc 3 opções)
14. Pergunta body sections: "O que mais importa pra você agora?" / "O que você quer evitar?"
15. Constrói frontmatter, valida via `ajv` contra `config/schemas/perfil-vibecoder.schema.json`
16. Se valid: escreve `_perfil-vibecoder.md` com `created_at` e `updated_at` em ISO
17. Se invalid: mostra erros, repete perguntas problemáticas

### 5.2 `vibecoder-recommender`

**Persona:** consultor que sabe o catálogo, justifica cada recomendação.

**Inputs:** perfil parsed, curated-stack parsed
**Output:** `_recomendacao.md` no vault

**Sequência:**
1. `resolve(perfil, curatedStack)` → lista base (essentials + by_role + by_plan, deduped, filtra `ja_tem_instalado`, evita `incompatible`)
2. Para cada item com `source: aitmpl + aitmpl_id`: opcionalmente hidrata via `fetchItem(kind, aitmpl_id)` pra trazer descrição mais rica
3. Sugere 3-5 EXTRAS via `search(query)` onde `query` é construído de `linguagens_familiares + tipo_projeto`
4. Constrói output via `recomendacao-render.render(items, perfil)`
5. Escreve `_recomendacao.md`

### 5.3 `vibecoder-installer`

**Persona:** ops engineer que executa com cuidado, mostra o que vai fazer antes.

**Inputs:** perfil, recomendacao, project-root
**Output:** CLAUDE.md, _install.sh, settings.json patch (opcional)

**Sequência (já descrita em 4.4).**

**Restrição importante:** o patch de `~/.claude/settings.json` SEMPRE pede confirmação, mesmo em `modo_autonomia: autonomo`. É uma exceção deliberada — settings global é sagrada.

---

## 6. Lib modules

### 6.1 `lib/stack-resolver.mjs`

```javascript
export function resolve(perfil, curatedStack, opts = {}) → ResolvedItem[]
```

`ResolvedItem`: o item original do curated-stack com 1 campo extra: `source_section: 'essentials' | 'by_role' | 'by_plan'`.

Lógica:
1. Junta `essentials` + `by_role[perfil.papel] || []` + `by_plan[perfil.plano_claude] || []`
2. Dedupe por `name` (primeiro vence — essentials têm prioridade)
3. Filtra items cujo `name` está em `perfil.ja_tem_instalado.{kind}s`
4. Para cada `incompatible[*].items`: se mais de um aparece na lista resultante, mantém o primeiro (ordem de definição) e descarta os outros + retorna na propriedade `dropped` com razão

### 6.2 `lib/recomendacao-render.mjs`

```javascript
export function render(items, perfil, extras = []) → string  // markdown completo
```

Output: frontmatter (schema_version, generated_at, generated_for_perfil, counts, items[], incompatibilities_avoided[]) + body 2 seções ("O que isso instala", "Por que cada item").

### 6.3 `lib/claude-md-template.mjs`

```javascript
export function render(perfil) → string  // markdown completo
```

Seções condicionais — ex:
- Se `experiencia_dev in [nenhuma, iniciante]`: adiciona "Explique decisões em português antes de codar"
- Se `tolerancia_risco === 'baixa'`: adiciona "Confirme antes de qualquer rm/delete"
- Se `modo_autonomia === 'perguntativo'`: adiciona "Apresente plano antes de implementar"
- Se `intervencao_hooks !== 'silenciosa'`: adiciona "Os hooks anti-burro do Tino vão te ajudar"

### 6.4 `lib/settings-patch.mjs`

```javascript
export function computePatch(perfil) → { add: object, remove: string[], full: object }
export function applyPatch(currentSettings, patch) → object
export function backup(filePath) → string  // returns backup path
```

Funções puras (sem I/O direto, exceto `backup`).

`computePatch` define qual diff aplicar. Regras:
- `tolerancia_risco: alta` + `modo_autonomia: autonomo` → adiciona `permissions.allow: ['Bash(npm install:*)', 'Bash(git:*)', 'Read', 'Edit']`
- `tolerancia_risco: baixa` → adiciona `permissions.deny: ['Bash(rm:*)', 'Bash(curl:*)']`
- `intervencao_hooks: ativa|agressiva` → reserva slot pra hooks da Onda 2 com placeholder

### 6.5 `lib/install-sh-render.mjs`

```javascript
export function render(items, opts = {}) → string  // bash script completo
```

Output: shell script com:
- Header `#!/usr/bin/env bash` + `set -euo pipefail`
- Suporte a flag `--interactive` (pergunta por item — se interactive: lê stdin, pula com Enter)
- Por item: comando do `item.install` precedido de `echo "[N/total] Installing {name}..."`
- Trap erro: continua próximo item mas reporta no fim

---

## 7. Schemas

### 7.1 `config/schemas/recomendacao.schema.json` (JSON Schema draft-07)

Required no frontmatter:
- `schema_version: 1`
- `generated_at` (ISO date-time)
- `generated_for_perfil` (string, path)
- `counts` (object com `total`, `essentials`, `by_role`, `by_plan`, `extras_aitmpl`)
- `items` (array de objetos com `name`, `kind`, `source_section`, `install`, `why`)
- `incompatibilities_avoided` (array, pode ser vazio)

### 7.2 `docs/recomendacao-vibecoder.md`

Doc humana mesmo molde da Onda 0.

---

## 8. Wave decomposition (5 waves)

| # | Story | Pontos | Deps | Entrega |
|---|-------|--------|------|---------|
| W1 | Stack resolver + recomendação renderer + schema | 5 | — | `lib/stack-resolver.mjs` + `lib/recomendacao-render.mjs` + `config/schemas/recomendacao.schema.json` + 3 testes |
| W2 | `/tino:vibe-setup` + interviewer agent | 5 | W1 (não estritamente — agent pode rodar isolado) | Comando + agent + (sem novos libs além do uso de `lib/frontmatter.mjs` do MVP + `ajv`) |
| W3 | `/tino:vibe-stack` + recommender agent | 5 | W1, W2 | Comando + agent + integração resolver+render+aitmpl |
| W4 | `/tino:vibe-install` + installer agent + 3 libs | 8 | W3 | Comando + agent + `claude-md-template.mjs` + `settings-patch.mjs` + `install-sh-render.mjs` + 3 testes |
| W5 | `/tino:vibe-onboard` wizard + integração + README | 3 | W2, W3, W4 | Comando wizard + atualização README com seção "Tino vibecoder mode" |

Total: 26 pontos. Onda 0 tinha 20 (4×5). Onda 1 maior — esperado.

---

## 9. Test strategy

### Por wave

- **W1:** unit tests cobrindo `resolve()` com 5 perfis sintéticos; render gera markdown com frontmatter válido; schema valida fixtures
- **W2:** smoke test do agent (mocked answers via stdin redirect — se viável); validação de perfil resultante via schema da Onda 0
- **W3:** integration test que monta perfil + curated-stack mock + executa pipeline end-to-end
- **W4:** unit tests por lib; cobertura especial de settings-patch (edge cases: settings.json vazio, malformed, com keys extras); install.sh render verifica 1+ items por kind
- **W5:** smoke test do wizard (não roda real, só valida que o `.md` referencia os 3 outros comandos)

### Coverage target
80%+ nas libs novas. Agents prompts são qualitativos.

### Final gate
`npm test` retorna 87 (Onda 0) + ~25-30 novos = ~112-117 PASS, 0 FAIL. Suite total < 10s.

Distribuição estimada por wave:
- W1: ~12 testes (stack-resolver 6 + recomendacao-render 3 + recomendacao-schema 3)
- W2: ~2 testes (smoke do agent + validação de perfil resultante via schema)
- W3: ~3 testes (integration pipeline end-to-end com mocks)
- W4: ~12 testes (claude-md-template 4 + settings-patch 5 + install-sh-render 3)
- W5: ~1 teste (smoke do wizard `.md` referenciar os 3 outros comandos)

---

## 10. Deliverables checklist

Onda 1 está pronta quando:

- [ ] 4 comandos `.claude/commands/tino-vibe-*.md` criados e funcionais
- [ ] 3 agents `.claude/agents/vibecoder-*.md` criados
- [ ] 5 libs em `lib/` criados e testados
- [ ] `config/schemas/recomendacao.schema.json` criado
- [ ] `docs/recomendacao-vibecoder.md` criado
- [ ] `package.json` ganha script `npm run test:setup` (roda só os testes desta onda)
- [ ] Todos os testes passam (~112-117 total)
- [ ] Suite total < 10s
- [ ] Smoke test manual end-to-end (1 user fictício rodando `/tino:vibe-onboard`) confirmou que perfil é gerado, recomendação é gerada, install gera CLAUDE.md
- [ ] Zero regressão na Onda 0 (87 testes continuam green)
- [ ] README atualizado com seção "Modo vibecoder"

---

## 11. Riscos e questões abertas

### Risco 1: Agents prompts difíceis de testar

Não há solução boa pra teste automatizado de prompts de agent em isolamento. Mitigação: smoke test manual end-to-end no fim, e qualidade dos prompts revisada em code review.

### Risco 2: settings.json patch é destrutivo

Mitigação tripla: backup obrigatório (`.tino-bak.<ISO>`), diff sempre mostrado, OK explícito SEMPRE pedido (mesmo em `modo_autonomia: autonomo`).

### Risco 3: aitmpl.com lento ou off

Mitigação: `aitmpl-client` da Onda 0 já tem cache + stale-while-error + AitmplUnavailableError. Quando `aitmpl-client` joga `AitmplUnavailableError`, recommender continua só com `curated-stack` (graceful degrade documentado).

### Risco 4: Tamanho da onda

26 pontos é maior que Onda 0 (20). Se durante execução qualquer wave passar de 1h sem completar, é sinal de re-decomposição. Não dividir em Onda 1A/1B preventivamente — escalonar reativamente se acontecer.

### Questão aberta 1: re-rodar `/tino:vibe-setup` com perfil existente

Decisão: prompt "atualizar?" antes de sobrescrever; se `--re-run` flag, força sobrescrita. Schema-validate ANTES de gravar pra garantir que update parcial não corrompe.

### Questão aberta 2: CLAUDE.md já existente no project-root

Decisão: backup pra `CLAUDE.md.tino-bak.<ISO>` e prompt "sobrescrever?". `modo_autonomia: autonomo` ainda confirma neste caso (CLAUDE.md é arquivo de "voz do user" — perigoso sobrescrever sem aviso).

### Questão aberta 3: como o wizard sabe que cada subcomando completou OK

Decisão: cada subcomando termina com uma linha estruturada `[VIBECODER-RESULT] ok|error <razao>` no stdout. Wizard parseia.

---

## 12. Próximo passo

Após aprovação deste spec, transição pra skill `writing-plans` que vai produzir um plano executável. A execução usa `epic-executor` no padrão validado nas Ondas 0 (4 waves) e MVP (8 waves).
