# Prompt canonico — Extracao de perfil Tino

Voce vai ler um conjunto de arquivos markdown de um vault Obsidian e produzir **um unico arquivo** `_perfil.md` estruturado. Esse arquivo alimenta o ranker do Tino, que decide quais novidades de IA o usuario vai ver.

## Contexto

- **Nome do vault**: `{{VAULT_NAME}}`
- **Arquivos-fonte** (paths relativos ao vault, ja ranqueados por relevancia):

{{VAULT_FILES}}

## Objetivo

Extrair 3 dimensoes do perfil do usuario a partir desses arquivos:

1. **Identidade** — quem ele eh profissionalmente, que stack usa, que papel desempenha.
2. **Foco ativo** — o que ele esta aprendendo/construindo/pesquisando AGORA (ultimos 90 dias).
3. **Evita** — o que ele explicitamente nao quer ver (temas, formatos, hype).

## Formato exato de saida

```
---
tipo: perfil
modo: final
gerado_em: YYYY-MM-DD
fontes: N
---

# Perfil — {{VAULT_NAME}}

## Identidade
**Chips:** [chip1, chip2, chip3]

Paragrafo narrativo curto (2-3 sentencas) descrevendo quem o usuario eh. Cada afirmacao termina com `(fonte: arquivo.md)`.

## Foco ativo
**Chips:** [topico1, topico2]

- Bullet descrevendo 1 foco ativo (fonte: arquivo.md)
- Bullet descrevendo outro foco (fonte: arquivo.md)

## Evita
- Item evitado (fonte: arquivo.md)
- Outro item evitado (fonte: arquivo.md)

## Fontes consideradas
- arquivo1.md
- arquivo2.md
```

## Regras inviolaveis

### Regra 1 — Conservadorismo

**Nunca chute.** Se nao ha evidencia explicita nos arquivos-fonte, o campo fica vazio ou marcado `_(sem evidencia nos arquivos-fonte)_`. Campos vazios sao sempre preferiveis a inferencias especulativas. Um perfil magro e correto vale mais que um perfil gordo e errado — o ranker do Tino precisa confiar que o que esta ali eh real.

Exemplos:
- Se o usuario menciona "uso Next.js" -> chip `next.js` vai em Identidade.
- Se o usuario diz "to aprendendo RAG" -> chip `rag` vai em Foco ativo.
- Se NAO ha mencao a GraphQL em nenhum arquivo -> **nao** coloque `graphql` so porque "parece que faz sentido". Omita.

### Regra 2 — Citacao

Toda afirmacao nao-trivial (frase narrativa, bullet de foco, item de evita) termina com `(fonte: path/relativo.md)`. Se a afirmacao vem de multiplos arquivos, cite o mais especifico ou use `(fontes: a.md, b.md)`.

Chips nao precisam de citacao individual (sao resumos agregados), mas **so** podem aparecer se houver menção literal no corpo dos arquivos-fonte.

### Regra 3 — Escopo temporal

- **Identidade**: atemporal. Pode vir de `README`, `sobre.md`, `perfil.md`, `about.md`.
- **Foco ativo**: 90 dias. Priorize arquivos com headers tipo "Aprendendo agora", "Foco atual", "Estudando", ou frontmatter `tags: [foco, ativo]`. Ignore projetos arquivados/antigos.
- **Evita**: vem de blocos explicitos — header "Evita", frases tipo "sem interesse em X", "nao uso Y", "cansei de Z".

### Regra 4 — Chips

Cada secao tem uma linha de chips antes do corpo:
- Chips sao tokens curtos (1-3 palavras), lowercase, separados por virgula, dentro de `[...]`.
- **Maximo 8 chips** por secao. Se tiver mais candidatos, priorize os mais frequentes/especificos.
- Formato YAML-array-inline para o parser do `lib/frontmatter.mjs` nao quebrar caso voce os mova pro frontmatter no futuro.

### Regra 5 — Nao expanda o escopo

Voce so escreve `{vault}/Tino/_perfil.md`. Nunca modifique, mova ou crie outros arquivos no vault do usuario. Se precisar de dados que nao estao nos arquivos-fonte listados, pare e pergunte em vez de buscar mais.

## Checklist antes de escrever

- [ ] Li cada arquivo-fonte listado com a tool `Read`
- [ ] Cada chip vem de mencao literal
- [ ] Cada bullet narrativo tem citacao de fonte
- [ ] Campos sem evidencia estao explicitamente vazios, nao inventados
- [ ] Frontmatter esta com `modo: final` e contagem correta de `fontes`
- [ ] Saida esta em `{vault}/Tino/_perfil.md` (sobrescrevendo placeholder)

Se algum item do checklist falhar, corrija antes de chamar `Write`.
