# EPIC-TINO: Tino MVP — curador local-first de novidades de IA

Sistema clonável que roda 100% no Claude Code do usuário. Lê vault Obsidian read-only, monitora fontes de IA, ranqueia novidades com justificativa cita-vault, e escreve tudo em `{vault}/Tino/` como markdown com frontmatter. Dashboard HTML standalone lê o vault ao vivo via File System Access API.

## Critérios de sucesso (do usuário final)

1. **Reduz consumo desenfreado** — limite de 5 highlights + permissão explícita pra ignorar
2. **Diminui ansiedade** — veredito "ignore por ora" é uma feature, não ausência
3. **Sabe o que foi lançado** — cobertura 95%+ das fontes whitelisted
4. **Confia na curadoria** — cada nota cita trecho do vault
5. **Produtividade** — favoritar → deep-dive acionável
6. **Qualidade emocional** — design editorial calmo, zero doom-scroll

## Critérios de sucesso (projeto clonável)

- Um dev qualquer consegue `git clone` + rodar setup em <10min
- Zero dependência de serviço externo pago (usa Claude Code do próprio user)
- Zero dado sai da máquina do user além do que os próprios scrapers consultam

---

## Fases e Stories

### Fase 1: Fundação

| Story | Título | Pontos | Prio | Deps | FR |
| F1-S01 | Scaffold estrutura + git + servidor local | 3 | P0 | — | FR-001 |
| F1-S02 | Bibliotecas core frontmatter e vault-scanner | 5 | P0 | F1-S01 | FR-002 |

### Fase 2: Ingestão

| Story | Título | Pontos | Prio | Deps | FR |
| F2-S01 | Profile extractor e comando tino-setup | 5 | P0 | F1-S02 | FR-003 |
| F2-S02 | Sources fetcher RSS e config default | 5 | P0 | F1-S02 | FR-004 |

### Fase 3: Inteligência e orquestração

| Story | Título | Pontos | Prio | Deps | FR |
| F3-S01 | Ranker agent e prompts de calibração | 5 | P0 | F2-S01, F2-S02 | FR-005 |
| F3-S02 | Refresh sync e deep-dive commands | 5 | P0 | F3-S01 | FR-006 |

### Fase 4: Interações e validação

| Story | Título | Pontos | Prio | Deps | FR |
| F4-S01 | Thumbs-down log e dashboard integração | 3 | P0 | F3-S02 | FR-007 |
| F4-S02 | E2E suite validando critérios e README | 8 | P0 | F4-S01 | FR-008 |

---

## Requisitos funcionais (FR)

- **FR-001** Repositório clonável com git inicializado e dashboard.html servível via HTTP local
- **FR-002** Parser/serializer de frontmatter YAML + scanner que pontua arquivos do vault por sinal de identidade
- **FR-003** Comando `/tino:setup` que gera `{vault}/Tino/` com `_perfil.md` draft extraído do vault
- **FR-004** `/tino:refresh` busca novidades de ~20 fontes configuradas em `config/sources.default.yaml`
- **FR-005** Ranker recebe perfil + novidades e produz `.md` por novidade com nota 0-10, veredito, resumo, justificativa com citação do vault
- **FR-006** `/tino:refresh` orquestra pipeline completo; profile-sync auto-sugere após 20 refreshes; `/tino:deep-dive <id>` enriquece favoritos
- **FR-007** Dashboard registra thumbs-down em `{vault}/Tino/_ajustes.md`; ranker lê esse arquivo como sinal de treino no próximo refresh
- **FR-008** Suite E2E valida todos os critérios de sucesso; README traz tutorial passo-a-passo pra comunidade

## Arquitetura

- **Backend** = Claude Code local + scripts Node.js determinísticos em `lib/`/`scripts/`
- **DB** = pasta `{vault}/Tino/` com markdown + frontmatter (portável, inspecionável pelo Obsidian)
- **Frontend** = `dashboard.html` single-file, lê/escreve vault via File System Access API
- **Zero infra web** — nada de Vercel, Supabase, banco remoto
