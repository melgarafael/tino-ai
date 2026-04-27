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
