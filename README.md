# Tino — curador local-first de novidades de IA

Tino é um segundo-leitor discreto. Ele roda 100% na sua máquina, dentro do seu Claude Code, lê o seu vault Obsidian, monitora as fontes de IA que você configurou, e escreve de volta no próprio vault um punhado de novidades ranqueadas — cada uma com uma justificativa do porquê importa *para você*, hoje.

Não é um feed. Não é uma newsletter. Não é um SaaS. É um pequeno curador pessoal — com o tino (o discernimento) necessário para cortar ruído.

> Tino /ˈtʃinu/ · do latim *acumen*. Faculdade de perceber o que é relevante; bom senso; discernimento.

---

## Por que Tino existe

O mercado de IA hoje produz mais novidade relevante por dia do que qualquer pessoa consegue ler. E a resposta convencional — mais feeds, mais Twitter, mais newsletters — piora o problema: você consome mais, decide pior, e se sente culpado por não estar "em dia".

Tino inverte a equação. Ele **reduz consumo**, não aumenta. Lê tudo no seu lugar, filtra 95% fora, e te entrega um resumo curto e **acionável** com três perguntas respondidas para cada item:

1. **O que é?** (uma frase)
2. **Por que importa PARA MIM?** (ligado ao que está no seu vault — projetos ativos, stack, foco do momento)
3. **O que fazer com isso?** (foca hoje · considera · ignora por ora)

E tudo vai para dentro do seu Obsidian. Nada fica na nuvem. Nada sai da sua máquina.

---

## Critérios que o Tino atende

O Tino foi construído contra uma barra clara de sucesso do usuário final. Cada item abaixo tem teste E2E automatizado em `tests/e2e/` — rode `npm run test:e2e` para ver.

- ✓ **Reduz consumo, não aumenta.** No máximo 5 novidades no bloco "focar hoje". O resto fica agrupado ou descartado com tranquilidade.
- ✓ **Dá permissão de ignorar.** A seção "ignorar por ora" é explícita, desculpabilizante, e vem junto da contagem total para você ver o filtro operando.
- ✓ **Cobre o terreno que importa.** O pipeline roda contra múltiplas fontes (blogs oficiais, changelogs, papers, comunidade) — não só o Twitter barulhento.
- ✓ **Explica por que algo importa para VOCÊ.** Cada card expande num bloco "Por que importa para você" com citação de um arquivo real do seu vault. Nada de resumo genérico.
- ✓ **Deixa você salvar o que importa.** Favoritar um item o marca no vault e libera o comando `/tino:deep-dive`, que enriquece o material com tutoriais, casos de uso e sinal da comunidade.
- ✓ **Parece biblioteca, não feed.** Fundo escuro calmo, tipografia editorial (Newsreader), zero shake/bounce/badge de notificação. Desenhado para não te puxar pelo colarinho.

Dois critérios de projeto, também testados:

- ✓ **Clonável em 3 comandos.** `git clone → npm install → npx playwright install chromium` e tudo roda. Sem conta, sem chave, sem serviço externo obrigatório.
- ✓ **Pipeline determinístico auditável.** O modo `--mock` é uma heurística pura, sem LLM — você pode rodar offline, auditar linha a linha e reproduzir resultados exatos.

---

## Pré-requisitos

Você vai precisar de um ambiente modesto:

| Requisito | Versão mínima | Por quê |
|-----------|---------------|---------|
| [Claude Code](https://docs.anthropic.com/claude/docs/claude-code) | última | É o runtime dos comandos `/tino:*` (skills + agents) |
| Node.js | 20+ | Scripts CLI em ESM puro (node --test nativo) |
| Python 3 | 3.8+ | Serve o `dashboard.html` estático em localhost |
| Chrome / Edge / Arc / Brave | qualquer recente | O dashboard usa a [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (Chromium-only) para ler e escrever no vault |
| Um vault Obsidian | qualquer | Pode ser novo ou existente. Precisa só de uma pasta de markdowns. |

Não é obrigatório ter o Obsidian instalado. O Tino escreve markdown puro — qualquer editor serve. O Obsidian vira útil quando você quer navegar, linkar notas e usar a rede do seu segundo cérebro.

---

## Instalação

Quatro passos. Menos de dois minutos.

```bash
# 1. Clone o repo (pode ser em qualquer lugar)
git clone https://github.com/rafaelmelgaco/tino-ai.git
cd tino-ai

# 2. Deps do Node
npm install

# 3. Instala o Tino globalmente no seu Claude Code + PATH
bash install.sh

# 4. (opcional) Chromium para os testes E2E
npx playwright install chromium
```

**O que o `install.sh` faz:**

- Salva o caminho do repo em `~/.tino/config.sh` como `TINO_HOME`
- Symlinka `bin/tino` → `~/.local/bin/tino` (CLI global)
- Symlinka os 4 slash commands → `~/.claude/commands/tino-*.md` (funcionam em **qualquer projeto** do Claude Code, não só dentro do repo)
- Symlinka os 3 agents → `~/.claude/agents/`
- Tudo reversível via `uninstall.sh` — repo e vaults ficam intactos

Depois disso, tanto o CLI `tino` quanto os `/tino:*` funcionam de **qualquer diretório**. Você pode apagar o repo da memória mental — só precisa saber do comando.

**Requisitos de PATH:** se `~/.local/bin` ainda não está no teu `$PATH`, o install script avisa. Adicione ao seu shell rc:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Dependências instaladas:

- Produção: `fast-xml-parser` (RSS/Atom) e `yaml` (config). É isso.
- Dev: `@playwright/test` (E2E). É isso também.

Sem framework web, sem bundler, sem transpilador. Node puro + HTML estático.

---

## Primeiro uso

O fluxo canônico tem quatro momentos. Todos rodam do terminal, dentro do diretório do projeto.

### 1. Rode o setup no Claude Code

Dentro do seu Claude Code, na pasta do Tino, execute:

```
/tino:setup /caminho/absoluto/do/seu/vault
```

O que o `/tino:setup` faz:

1. Escaneia o vault recursivamente e lista as 30 notas com maior sinal (densidade de conteúdo × recência × backlinks).
2. Invoca o subagent `profile-extractor` (ou um fallback heurístico determinístico) para sintetizar um `_perfil.md` a partir daquelas notas.
3. Cria a pasta `{vault}/Tino/` com:
   - `_perfil.md` (identidade profissional · foco ativo · evita)
   - `_config.md` (fontes monitoradas · frequência sugerida)
   - `novidades/` (vazio, por ora)
   - `favoritos/` (vazio)

Ao terminar, abre os dois arquivos de configuração pra você revisar.

### 2. Revise seu perfil

Abra `{vault}/Tino/_perfil.md`. Vai parecer algo assim:

```markdown
---
nome: Rafael
atualizado: 2026-04-21
foco_ativo: [Claude Agent SDK, Managed Agents, Context engineering]
identidade: [SaaS B2B, Founder, CTO, Next.js, Supabase]
evita: [Geração de vídeo por IA, Hype de AGI]
processadas: 0
favoritadas: 0
thumb_up: 0
thumb_down: 0
acerto: 0
---

## Identidade
Founder e CTO do Tomik CRM. Construo SaaS B2B para equipes comerciais enxutas...

## Foco ativo
- Claude Agent SDK — construindo o Tino como projeto clonável
- Managed Agents — orquestração multi-agente oficial

## Evita
- Geração de vídeo por IA
- Debates filosóficos sobre consciência de LLMs
```

**Edite à vontade.** Este é o coração do Tino — é a partir daqui que o ranker decide o que foca e o que ignora. Menos é mais. Seja específico. "Claude Agent SDK" é melhor que "AI frameworks".

### 3. Rode o primeiro refresh

```
/tino:refresh
```

O que acontece:

1. `scripts/fetch-all.mjs` busca as fontes em `config/sources.default.yaml` (ou as do seu `_config.md`) e normaliza os itens em JSON no cache local (`.tino-cache/`).
2. `scripts/rank.mjs --mock` rankeia cada item contra seu `_perfil.md`, dando nota 0–10 e um veredito (Foca · Considera · Acompanha · Ignore).
3. Escreve um `.md` por novidade em `{vault}/Tino/novidades/` com frontmatter estruturado e justificativa personalizada.

O modo `--mock` é determinístico — ele não chama LLM algum. É uma heurística baseada em sobreposição de vocabulário (foco ativo × item) + tipo da fonte + ajustes. Dá um baseline honesto sem custo.

### 4. Abra o dashboard e conecte o vault

```bash
npm run serve
# abre http://localhost:5173/dashboard.html no seu Chrome/Edge/Arc/Brave
```

No primeiro acesso você está em **modo demo** — vê dados de exemplo. Clique em **Conectar vault** no topo, navegue até a pasta do seu vault, autorize leitura e escrita.

A partir daí o dashboard lê **ao vivo** a pasta `{vault}/Tino/novidades/`. Toda vez que você roda `/tino:refresh`, um F5 no dashboard traz as novidades atualizadas — nenhum build, nenhum deploy, nenhum servidor.

---

## Comandos disponíveis

O Tino expõe quatro comandos via Claude Code (skills carregadas de `.claude/commands/`).

### `/tino:setup`

Inicializa o Tino em um vault. Escaneia, sintetiza perfil, cria a estrutura de pastas.

```
/tino:setup /Users/voce/Documents/vault
```

Só precisa rodar uma vez por vault. Se você quiser resetar, apague `{vault}/Tino/` e rode de novo.

### `/tino:refresh`

Ciclo canônico: coleta → rankeia → escreve. É o comando que você vai rodar regularmente — 1 a 2× por dia, mais ou menos.

```
/tino:refresh
```

Usa por padrão modo `--mock` (heurístico, sem LLM). Para usar o ranker real Claude quando disponível, passe `--real` (requer subscription e tem custo de token).

### `/tino:profile-sync`

Regenera o `_perfil.md` re-escaneando o vault, preservando contadores de uso (processadas, favoritadas, thumbs). Útil quando você muda de foco — novo projeto, nova stack, novo tema de estudo — e quer que o ranker acompanhe.

```
/tino:profile-sync
```

Sempre cria backup do perfil antigo em `_perfil.backup-<timestamp>.md`.

### `/tino:deep-dive`

Aprofunda uma novidade **já favoritada**. Chama o subagent `deep-diver` que combina WebSearch + o conteúdo original para produzir:

- Tutorial de uso (passo-a-passo, exemplos de código quando aplicável)
- Casos de sucesso da comunidade
- Termômetro do sentimento (o que estão falando, links)

```
/tino:deep-dive anthropic-agent-sdk-1-0
```

Escreve o resultado em `{vault}/Tino/favoritos/<slug>.md`. Só roda em favoritos para proteger seu budget — aprofundar 50 novidades por dia sairia caro.

---

## Estrutura do projeto

```
tino-ai/
├── .claude/
│   ├── agents/             # Subagents: profile-extractor, ranker, deep-diver
│   └── commands/           # Skills: /tino:setup, :refresh, :profile-sync, :deep-dive
├── config/
│   ├── sources.default.yaml   # 30+ fontes RSS/Atom pré-configuradas
│   └── prompts/            # Prompts dos subagents (extract-profile, rank-novelty, deep-dive)
├── lib/                    # Módulos puros, reusados entre scripts
│   ├── fetch.mjs             # HTTP + retry + timeout
│   ├── rss-parser.mjs        # Parser RSS/Atom via fast-xml-parser
│   ├── frontmatter.mjs       # Parse/serialize YAML frontmatter
│   ├── vault-scanner.mjs     # Scanner de notas do Obsidian
│   ├── rank-mock.mjs         # Heurística determinística do ranker mock
│   └── adjustments.mjs       # Leitura do _ajustes.md (feedback loop)
├── scripts/                # Entradas CLI invocadas pelos comandos
│   ├── setup.mjs
│   ├── refresh.mjs
│   ├── profile-sync.mjs
│   ├── deep-dive.mjs
│   ├── fetch-all.mjs
│   └── rank.mjs
├── tests/                  # 63 unit tests (node --test)
│   ├── *.test.mjs
│   ├── fixtures/             # Fixtures RSS + perfil + _ajustes
│   └── e2e/                  # 7 specs Playwright (critérios do usuário)
├── tino-vault-sample/      # Vault de demo — útil pra teste e tutorial
│   ├── Tino/                 # Saída pronta (perfil + novidades exemplo)
│   └── perfil-raw/           # Vault "cru" (não-Tino) pra rodar setup contra ele
├── dashboard.html          # Dashboard single-file (52KB, sem build step)
├── playwright.config.mjs   # Config do E2E (web server embutido na porta 5174)
└── package.json            # Scripts: test · test:e2e · test:all · serve
```

Todos os scripts e libs são ESM puro (`"type": "module"`). Nada de CommonJS, nada de TypeScript, nada de build. `node scripts/X.mjs` roda direto.

---

## Fontes customizadas

O Tino vem com ~30 fontes default em `config/sources.default.yaml` cobrindo:

- **Labs e empresas**: Anthropic, OpenAI, Google DeepMind, Meta AI, Mistral, Cohere, Hugging Face
- **Infra e dev-tools**: Vercel Changelog, Supabase, LangChain, LlamaIndex
- **Papers**: arXiv cs.CL, Papers With Code
- **Comunidade**: Hacker News (keyword: AI/LLM), subreddits curados
- **Newsletters editoriais**: Ben's Bites, Import AI, The Rundown

Para customizar, edite `{seu-vault}/Tino/_config.md` — ele tem uma seção `## Fontes` em YAML inline:

```yaml
## Fontes

- id: anthropic-blog
  name: Anthropic Blog
  type: rss
  url: https://www.anthropic.com/news/rss.xml
  active: true
  weight: 1.0
- id: minha-fonte-custom
  name: Blog do meu parceiro
  type: atom
  url: https://exemplo.com/feed.atom
  active: true
  weight: 1.2   # pondera acima do default
```

O `weight` é multiplicado na nota final — use para amplificar fontes que você confia mais e reduzir as ruidosas. Para desativar temporariamente, `active: false`.

---

## Como funciona o ranking

Tino tem dois modos de ranker, ambos funcionam no mesmo contrato de entrada e saída:

### Modo mock (default)

Heurística pura em `lib/rank-mock.mjs`. Dado um item (título + resumo + tipo + fonte) e um perfil (foco_ativo + identidade + evita), calcula nota 0–10 com base em:

- **Sobreposição de vocabulário** entre item e `foco_ativo` do perfil (peso dominante)
- **Bônus de tipo** (`release` > `paper` > `news` > `community`)
- **Bônus de fonte** (peso do `_config.md`)
- **Penalidade de `evita`** — se o título bate com termo anti-filtro
- **Ajustes do feedback loop** — thumbs-down previos em tags similares puxam a nota pra baixo

É determinístico: mesmo perfil + mesmo item = mesma nota, sempre. Útil pra reproduzir bugs, pra auditar decisões, pra rodar offline.

### Modo real (Claude)

Mesmo contrato, mas o ranker é um subagent Claude (`ranker.md`) carregado pelo Claude Code. Recebe o perfil completo como contexto + cada item, e responde com nota + veredito + justificativa personalizada. Tende a ser mais sensível a nuance (ex: "paper de RL aplicado a robótica" não bate vocabulário com seu foco "Claude Agent SDK", mas o Claude entende que é ortogonal).

Custo é por token. O mock é gratuito. Para começar, use o mock — quando o baseline não estiver afiado, suba para o real.

A flag `--mock` no `scripts/rank.mjs` chaveia entre os dois. Os comandos `/tino:refresh` expõem a opção.

---

## Feedback loop

Você ensina o Tino clicando nos botões **Certeiro** ou **Errou** em cada card expandido do dashboard.

O que isso faz:

1. Dashboard escreve (via File System Access API) no arquivo `{vault}/Tino/_ajustes.md` uma seção `## Certeiros` ou `## Errados` listando o id + título.
2. Incrementa o contador `thumb_up` ou `thumb_down` no frontmatter.
3. Se você marca como "Errou" muitos itens com um tipo comum (ex: múltiplos itens com tag `ios-development`), o `ignore_tags` cresce automaticamente.
4. Na próxima rodada de `/tino:refresh`, o ranker lê o `_ajustes.md` e aplica penalidade a itens similares aos `thumbs_down` recentes e zera a nota de itens com tag em `ignore_tags`.

Resultado: o Tino erra menos ao longo das semanas. É uma malha fechada simples — sem ML, sem embeddings, sem servidor.

Dica: marque Certeiro de vez em quando também. Sem sinal positivo, o sistema super-penaliza e fica tímido demais.

---

## Arquitetura: local-first + zero infra

Tino foi desenhado em oposição explícita ao modelo SaaS do mainstream. Decisões-chave:

- **Sem backend.** O dashboard é um único arquivo HTML estático que lê o vault via File System Access API. O "banco" é a pasta de markdowns.
- **Sem build step.** Nada de Vite, Next, webpack, esbuild. `python3 -m http.server` é o deploy.
- **Sem conta, sem chave.** Você pode rodar o Tino offline. Só sai da sua máquina os HTTP GETs para as fontes RSS que você mesmo configurou.
- **Sem estado central.** Dois usuários rodando Tino contra o mesmo vault-compartilhado têm resultados idênticos (desde que rodem o mesmo cache). Zero sincronia.
- **Código auditável.** ~2500 linhas de JS puro. Sem dependências misteriosas. Você pode ler tudo em uma tarde.

Trade-offs conscientes:

- **Não escala pra time.** Se 3 pessoas querem notificações comuns, o Tino não resolve. Intencional.
- **Não é tempo-real.** Você roda `/tino:refresh` — ele não te acorda. Por design: notificação é drogade do engajamento.
- **Dashboard depende de browser Chromium.** Firefox não tem File System Access API ainda. Se quiser suporte Firefox, abra uma issue.

---

## Rodando os testes

O projeto tem duas suítes:

```bash
# 1. Unit + integration (63 testes, ~1.5s)
npm test

# 2. End-to-end via Playwright (7 critérios do usuário, ~6s)
npm run test:e2e

# 3. Tudo junto
npm run test:all
```

Os testes E2E são a espinha da validação do projeto. Cada critério de sucesso do usuário (redução de consumo, permissão de ignorar, cobertura, justificativa, favoritar, design calmo) tem um spec dedicado em `tests/e2e/`. Se você quebrar um comportamento visível, um teste cai.

O config do Playwright (`playwright.config.mjs`) sobe automaticamente um `python3 -m http.server` na porta 5174 apontando para a raiz do repo. Você não precisa iniciar nada manualmente.

---

## Privacidade

O que sai da sua máquina:

- Requisições HTTP GET para os feeds RSS/Atom em `config/sources.default.yaml` ou no seu `_config.md`. Nada além do User-Agent default do Node.
- Requisições para Google Fonts (Newsreader + Inter), feitas pelo browser ao carregar o `dashboard.html`. Se isso incomoda, baixe as fontes localmente e edite o `<link>` no HTML.
- **Se, e somente se, você usar modo `--real` do ranker ou o `/tino:deep-dive`**: o Claude Code faz chamadas à API da Anthropic com o conteúdo dos itens + seu perfil. É aí que você decide conscientemente compartilhar.

O que **nunca** sai:

- Qualquer arquivo do seu vault fora os cabeçalhos curtos passados ao ranker (e mesmo isso só no modo `--real`).
- Telemetria, analytics, pings. Não existe.
- Contadores, estatísticas, IDs de usuário. Não existe backend para onde mandar.

Rode `npm test` e `npm run test:e2e` com a rede desligada e tudo passa — exceto os testes que batem em feeds externos (que usam fixtures locais).

---

## Contribuindo

PRs são bem-vindos. Fluxo sugerido:

1. Abra uma issue primeiro se for algo não-trivial — quero discutir o desenho antes de você investir tempo.
2. Fork + branch (`feat/minha-ideia` ou `fix/bug-no-ranker`).
3. Escreva teste (unit em `tests/` ou E2E em `tests/e2e/`) que falha antes e passa depois.
4. Mantenha o estilo: ESM puro, funções pequenas, nomes em português no código de domínio e em inglês no utilitário.
5. Rode `npm run test:all` antes de abrir o PR.
6. PR pequeno > PR grande. Se sua mudança toca mais de 5 arquivos, considere dividir.

Áreas onde ajuda é especialmente bem-vinda:

- Mais fontes curadas em `config/sources.default.yaml` (com `weight` justificado no PR).
- Ranker real para providers além da Anthropic (OpenAI, Gemini, local via Ollama).
- Suporte a Firefox (polyfill da File System Access API ou fallback via drag-drop).
- Tradução do README e comandos para inglês (o Tino nasceu em pt-BR mas pode ganhar o mundo).

---

## Licença

MIT. Use, forque, venda, modifique — só mantenha o copyright e não me culpe se der ruim.

---

## Agradecimentos

Construído em cima do trabalho de muita gente:

- **Anthropic** — por ter aberto o Claude Code o suficiente pra essa ideia ser viável.
- **Obsidian** — por ter provado que markdown + links é o melhor sistema de notas já inventado.
- **Playwright** — pela experiência de escrever testes E2E sem chorar.
- **Comunidade local-first** — Ink & Switch, Martin Kleppmann, Linus Lee, Maggie Appleton — pelos papers e ensaios que ancoraram a estética do projeto.

Se o Tino te serve, me conta (`rafael@maudibrasil.com.br`). Se não serve, me conta também — é como o feedback loop funciona.

_ter tino é ter discernimento._
