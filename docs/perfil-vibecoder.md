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
