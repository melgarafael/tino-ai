---
description: Enriquece uma novidade favoritada com tutorial de uso, casos de sucesso e termometro da comunidade. Escreve em Tino/favoritos/.
---

# /tino:deep-dive — Deep dive de uma novidade

Voce vai enriquecer uma novidade **ja favoritada** pelo usuario com:
- Tutoriais de uso (passo-a-passo, exemplos)
- Casos de sucesso (quem usou, resultados)
- O que a comunidade esta falando (posts, threads, repos)

Esta etapa tem **custo** (agent + WebSearch). So roda em favoritos para proteger budget.

## Passo 1 — Identificar a novidade

Aceite um argumento posicional com o id/slug (ex: `/tino:deep-dive anthropic-agent-sdk-1-0-2026`). Se nao veio argumento, pergunte: `Qual id/slug da novidade que voce quer aprofundar? (olhe os .md em {vault}/Tino/novidades/)`.

## Passo 2 — Validar com o script

Execute via Bash (mock para validar favorito sem custo):

```bash
tino deep-dive --vault "$VAULT" --id "$ID" --mock
```

- Se exit code != 0: a novidade nao existe OU nao tem `favorito: true`. Mostre o erro e pare.
- Se exit code == 0: o script gerou um **template** em `{vault}/Tino/favoritos/{slug}-deep-dive.md` com as 3 secoes vazias. O summary JSON no stdout tem o path.

## Passo 3 — Em modo real: invocar o subagent

Se o usuario quer a versao enriquecida (e nao so template), invoque o subagent `deep-diver` (definido em `.claude/agents/deep-diver.md`). Ele vai:

1. Ler o prompt canonico em `config/prompts/deep-dive.md`
2. Ler a novidade fonte em `{vault}/Tino/novidades/{slug}.md` (tem url, titulo, resumo)
3. Fazer WebSearch para tutoriais, casos e reacoes da comunidade
4. Reescrever `{vault}/Tino/favoritos/{slug}-deep-dive.md` preenchendo as 3 secoes com citacoes

## Passo 4 — Apresentar

Mostre ao usuario:
- Caminho do arquivo gerado
- Resumo de 3 linhas: quantos tutoriais encontrou, quantos casos, quantas fontes de comunidade

## Passo 5 — Fechar

Pergunte: `Quer abrir o arquivo {slug}-deep-dive.md no Obsidian?`.

## Observacoes

- Deep dive **so** roda se `favorito: true` no frontmatter da novidade — protecao de custo.
- Template mock tem as 3 secoes vazias; modo real preenche via agent.
- Nunca escreve fora de `{vault}/Tino/favoritos/`.
- Se quiser comparar antes/depois, mantenha uma copia do template mock antes de invocar o agent.
