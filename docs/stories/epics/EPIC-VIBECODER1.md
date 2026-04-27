# EPIC-VIBECODER1: Setup assistido do Tino vibecoder (Onda 1)

Onda 1 de 3 da expansão do Tino — assistente do "vibe coder júnior". Esta onda transforma a fundação da Onda 0 (87 testes green) em **experiência de uso completa**: triagem (entrevista) → recomendação (combina curated + aitmpl) → instalação (CLAUDE.md + settings.json + install.sh executável). 4 comandos `.claude/commands/tino-vibe-*`, 3 agents, 5 lib modules puros e testados.

**Decisão de UX (aprovada no brainstorm):** wizard `/tino:vibe-onboard` como porta padrão + 3 escape hatches (`/tino:vibe-setup`, `/tino:vibe-stack`, `/tino:vibe-install`). Comportamento de install é **derivado de `_perfil-vibecoder.md`** (`modo_autonomia`, `tolerancia_risco`), não de flags de comando.

## Critérios de sucesso (do user vibecoder júnior)

1. **Onboarding em < 10 minutos.** Triagem (3 min) + recomendação (1 min) + instalação (1 min) + leitura final (~2 min folga).
2. **CLAUDE.md customizado pro perfil.** Não é template genérico — incorpora papel, experiência, autonomia, tolerância a risco, anti-padrões.
3. **Recomendação visível antes do install.** `_recomendacao.md` no vault permite user revisar (e editar) antes de aplicar.
4. **Settings global protegido.** Patch de `~/.claude/settings.json` SEMPRE pede OK explícito, mesmo em `modo_autonomia: autonomo`.
5. **Escape hatches funcionam.** User experiente pode rodar só uma parte (ex: re-triagem 3 meses depois sem refazer install).

## Critérios de sucesso (projeto clonável)

- Zero regressão no MVP (63 testes) ou Onda 0 (87 testes total = 63 baseline + 24).
- Suite total continua < 10s.
- Suite focada `npm run test:setup` < 5s.
- Atomic commits por wave com prefixo `(vibecoder-onda1)`.
- Smoke test manual end-to-end aprovado antes de fechar epic.

---

## Fases e Stories

### Fase 1: Onda 1 — Setup Assistido

| Story | Título | Pontos | Prio | Deps | FR |
|---|---|---|---|---|---|
| F1-S01 | Schema do recomendacao + libs core (stack-resolver + recomendacao-render) | 5 | P0 | — | FR-VBC1-001, FR-VBC1-002 |
| F1-S02 | Triagem (perfil-writer + agent interviewer + comando vibe-setup) | 5 | P0 | F1-S01 | FR-VBC1-003 |
| F1-S03 | Recomendação (recommender-pipeline + agent recommender + comando vibe-stack) | 5 | P0 | F1-S02 | FR-VBC1-004 |
| F1-S04 | Instalação (claude-md-template + settings-patch + install-sh-render + agent installer + comando vibe-install) | 8 | P0 | F1-S03 | FR-VBC1-005 |
| F1-S05 | Wizard `/tino:vibe-onboard` + README + smoke test final | 3 | P0 | F1-S04 | FR-VBC1-006 |

Total: 26 pontos em 5 waves.

---

## Requisitos funcionais (FR)

- **FR-VBC1-001** — `config/schemas/recomendacao.schema.json` (JSON Schema draft-07) valida o `_recomendacao.md` gerado. Required: `schema_version, generated_at, generated_for_perfil, counts, items, incompatibilities_avoided`. `lib/stack-resolver.mjs::resolve(perfil, curated)` é função pura que combina essentials + by_role[perfil.papel] + by_plan[perfil.plano_claude], deduplica por `name`, filtra `ja_tem_instalado`, respeita `incompatible[]`. Retorna `{items, dropped}`. 6 testes.

- **FR-VBC1-002** — `lib/recomendacao-render.mjs::render(items, perfil, extras?, opts?)` produz markdown completo (frontmatter validável + body com seções "O que isso instala" / "Por que cada item"). 3 testes. Doc humana em `docs/recomendacao-vibecoder.md`. 3 testes do schema.

- **FR-VBC1-003** — `/tino:vibe-setup <vault-path> [--re-run]` invoca agent `vibecoder-interviewer` que conduz triagem (uma pergunta por vez, valida via JSON Schema da Onda 0, auto-detecta sistema/instalados), chama `lib/perfil-vibecoder-writer.mjs::write()` que valida + grava `{vault}/Tino/_perfil-vibecoder.md` com backup se existente. 3 testes do writer.

- **FR-VBC1-004** — `/tino:vibe-stack <vault-path>` invoca agent `vibecoder-recommender` que lê perfil, chama `lib/recommender-pipeline.mjs::runPipeline({perfil, curatedStackPath})` (combina resolver + extras opcionais via aitmpl-client + render), grava `{vault}/Tino/_recomendacao.md`. Graceful degrade quando aitmpl indisponível. 3 testes do pipeline.

- **FR-VBC1-005** — `/tino:vibe-install <vault-path> [--project-root <dir>]` invoca agent `vibecoder-installer` que: (a) gera `{project-root}/CLAUDE.md` via `lib/claude-md-template.mjs::render(perfil)` com backup; (b) gera `{vault}/Tino/_install.sh` (chmod +x) via `lib/install-sh-render.mjs::render(items, opts)`; (c) calcula patch de `~/.claude/settings.json` via `lib/settings-patch.mjs::computePatch(perfil)`, mostra diff, aplica COM CONFIRMAÇÃO EXPLÍCITA mesmo em modo autônomo + backup; (d) executa `_install.sh` conforme `modo_autonomia`. 4 + 5 + 3 = 12 testes.

- **FR-VBC1-006** — `/tino:vibe-onboard <vault-path>` é wizard que invoca os 3 outros em sequência com confirmação entre etapas. README atualizado com seção "Modo vibecoder (Onda 1)". Smoke test manual end-to-end passa.

---

## Arquitetura

- **Tipo de wave:** mistura — libs puras (testáveis com `node:test`) + agents/comandos (markdown, qualitativos). Gate de QA é `npm test` + verificação de estrutura dos arquivos `.md` (existência, frontmatter, content esperado).
- **Linguagem/stack:** Node.js 20+, ESM puro `.mjs`, `node:test` nativo, `node:assert/strict`. Agents e comandos como markdown.
- **Deps:** apenas o que já está. Sem `cheerio`. Reusa `ajv`, `ajv-formats`, `yaml`.
- **Boundary:**
  - Comandos `.md` invocam agents — nunca implementam lógica direta.
  - Agents leem perfil/recomendação e delegam computação determinística para libs.
  - Libs são puras (sem I/O exceto onde explicitado, ex: `backup`, `write`).
  - Side effects (escrever arquivo, executar shell, modificar settings.json) ficam no agent.
  - Zero modificação de código da Onda 0 ou MVP.
- **Spec:** `docs/superpowers/specs/2026-04-27-tino-vibecoder-setup-design.md`
- **Plano executável:** `docs/superpowers/plans/2026-04-27-tino-vibecoder-setup.md`

### Contracts expostos (para Onda 2 - Hooks Runtime)

- **Filesystem:** `{vault}/Tino/_perfil-vibecoder.md` populado com `intervencao_hooks`, `modo_autonomia` calibrados — Onda 2 lê pra calibrar agressividade dos hooks.
- **Filesystem:** `~/.claude/settings.json` com slot reservado `_tino_hooks_placeholder` — Onda 2 vai preencher com hooks reais.
- **Filesystem:** `{project-root}/CLAUDE.md` com referências aos hooks da Onda 2 quando `intervencao_hooks !== silenciosa`.
- **Module:** `lib/perfil-vibecoder-writer.mjs::validate(fm)` reusável por hooks que precisarem ler perfil em runtime.

### Decisões fixadas (não reabrir sem revisar spec)

- Wizard `/tino:vibe-onboard` é `.md` que orquestra via menção dos outros 3 comandos. Sem JS de orquestração — Claude entende a sequência. YAGNI.
- Settings.json patch SEMPRE confirma explicitamente — exceção deliberada ao `modo_autonomia: autonomo` (settings global é sagrada).
- CLAUDE.md vai pro project-root (não global). Razão: evita conflito com CLAUDE.md global do user.
- Backup automático em todas operações destrutivas: `_perfil-vibecoder.md.tino-bak.<ISO>`, `CLAUDE.md.tino-bak.<ISO>`, `settings.json.tino-bak.<ISO>`.
- Linhas estruturadas `[VIBECODER-RESULT] ok|error <kv pairs>` no stdout pra wizard parsear sucesso/falha.

---

## Wave-by-wave testable criteria

### F1-S01 (Wave 1) — Schema + libs core

1. **Given** `node --test tests/recomendacao-schema.test.mjs`, **Then** 3 PASS, 0 FAIL.
2. **Given** `node --test tests/stack-resolver.test.mjs`, **Then** 6 PASS, 0 FAIL.
3. **Given** `node --test tests/recomendacao-render.test.mjs`, **Then** 3 PASS, 0 FAIL.
4. **Given** `npm test`, **Then** 87 (Onda 0) + 12 = **99 PASS, 0 FAIL**.
5. **Given** `config/schemas/recomendacao.schema.json`, **When** parseio, **Then** é JSON válido com `required` contendo os 6 campos do FR-VBC1-001.
6. **Given** `docs/recomendacao-vibecoder.md`, **When** leio, **Then** documenta cada campo do schema.
7. **Given** `git log --oneline -10`, **Then** ≥ 3 commits desta wave com prefixo `(vibecoder-onda1)`.

### F1-S02 (Wave 2) — Triagem

1. **Given** `node --test tests/perfil-vibecoder-writer.test.mjs`, **Then** 3 PASS, 0 FAIL.
2. **Given** `npm test`, **Then** 99 + 3 = **102 PASS, 0 FAIL**.
3. **Given** `.claude/agents/vibecoder-interviewer.md`, **When** parseio frontmatter, **Then** tem `name`, `description` e `tools` válidos. Body documenta sequência de 16 steps.
4. **Given** `.claude/commands/tino-vibe-setup.md`, **When** parseio frontmatter, **Then** tem `description` e `argument-hint`. Body referencia `vibecoder-interviewer` agent.
5. **Given** `git log`, **Then** ≥ 2 commits novos com `(vibecoder-onda1)`.

### F1-S03 (Wave 3) — Recomendação

1. **Given** `node --test tests/recommender-pipeline.test.mjs`, **Then** 3 PASS, 0 FAIL.
2. **Given** `npm test`, **Then** 102 + 3 = **105 PASS, 0 FAIL**.
3. **Given** `.claude/agents/vibecoder-recommender.md` e `.claude/commands/tino-vibe-stack.md`, **When** inspeciono, **Then** comando referencia agent + agent referencia `lib/recommender-pipeline.mjs`.
4. **Given** `git log`, **Then** ≥ 2 commits novos com `(vibecoder-onda1)`.

### F1-S04 (Wave 4) — Instalação

1. **Given** `node --test tests/claude-md-template.test.mjs`, **Then** 4 PASS, 0 FAIL.
2. **Given** `node --test tests/settings-patch.test.mjs`, **Then** 5 PASS, 0 FAIL.
3. **Given** `node --test tests/install-sh-render.test.mjs`, **Then** 3 PASS, 0 FAIL.
4. **Given** `npm test`, **Then** 105 + 12 = **117 PASS, 0 FAIL**.
5. **Given** `.claude/agents/vibecoder-installer.md`, **When** inspeciono, **Then** body explicita "SEMPRE pergunta ao user antes de aplicar patch settings.json — exceção deliberada".
6. **Given** `.claude/commands/tino-vibe-install.md`, **When** inspeciono, **Then** referencia `vibecoder-installer` agent + suporta `--project-root` flag.
7. **Given** `git log`, **Then** ≥ 4 commits novos com `(vibecoder-onda1)` (3 libs + 1 agent + 1 comando = 5, mas pode ser menos se commits combinados).

### F1-S05 (Wave 5) — Wizard + README + smoke

1. **Given** `.claude/commands/tino-vibe-onboard.md`, **When** inspeciono, **Then** menciona os 3 outros comandos por nome (`/tino:vibe-setup`, `/tino:vibe-stack`, `/tino:vibe-install`) e descreve sequência de 4 etapas com confirmação.
2. **Given** `README.md`, **When** procuro "Modo vibecoder", **Then** seção existe, lista os 4 comandos, menciona aitmpl.com.
3. **Given** `npm test`, **Then** **117 PASS, 0 FAIL** (mesmo do W4 — wizard não adiciona testes unitários).
4. **Given** `time npm run test:setup`, **Then** roda em < 5s real time.
5. **Given** smoke test manual end-to-end (opcional mas recomendado), **Then** wizard conduz triagem mock + gera arquivos esperados em vault temporário.
6. **Given** `git log`, **Then** ≥ 1 commit novo com `(vibecoder-onda1)`.
