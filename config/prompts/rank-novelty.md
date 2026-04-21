# Prompt canonico — Rank de novidade (Tino)

Voce vai avaliar **uma unica novidade** de IA contra o `_perfil.md` do usuario e devolver um JSON estrito com nota, veredito, resumo, justificativa e cita-fonte. O Tino usa essa nota pra decidir o que o usuario ve no dashboard — entao sua saida alimenta a UX dele diretamente.

## Objetivo

Dar uma **nota de 0 a 10** que reflita o quanto essa novidade importa **para este perfil especifico** — nao pra "um dev de IA em geral". A nota eh comparativa contra o `foco_ativo`, `identidade` e `evita` do `_perfil.md`.

## Entradas

- `_perfil.md` — frontmatter YAML com `foco_ativo`, `identidade`, `evita` (arrays) + corpo narrativo com citacoes por arquivo.
- `novidade` — objeto com `titulo`, `resumo_bruto`, `data`, `fonte`, `url`, `tipo`.
- (opcional) `_ajustes.md` — frontmatter com `ignore_tags`, `boost_tags`. Respeite.

## Regra de calibracao (escala 0-10)

- **9.0-10.0 — Foca**: Novidade menciona termo literal de `foco_ativo` OU resolve problema conhecido citado no corpo do `_perfil.md`. Ex.: perfil com `foco_ativo: [Claude Agent SDK]` + novidade "Claude Agent SDK 1.0 released".
- **7.0-8.9 — Considera**: Relevante pra stack (`identidade`) ou tangencia `foco_ativo` sem bater literal. Nao urgente, mas util. Ex.: perfil com `identidade: [Next.js]` + novidade "Next.js 16 RC".
- **5.0-6.9 — Acompanha**: Interessante mas fora do momento. Tema amplo do ecossistema sem match direto. Ex.: "Google releases new model" sem mencao a nada do perfil.
- **<5.0 — Ignore**: Fora do contexto. Qualquer match com `evita` **forca** nota < 4. Ex.: perfil com `evita: [geracao de video]` + novidade sobre video-gen -> nota 2-3.

## Regra de justificativa

**Sempre cite um arquivo do vault** que motivou a nota. Preferencialmente o `_perfil.md` (default), ou um arquivo citado no corpo dele (ex.: `foco-ativo.md`, `stack.md`). Nunca cite fonte externa a novidade — sempre vault. Justificativa eh 1-3 frases, diretas, sem marketing.

## Regra de veredito (1 palavra, acao implicita)

- `Foca` (>=9) — usuario deve parar pra ler ja.
- `Considera` (>=7) — bookmark pra sprint atual.
- `Acompanha` (>=5) — feed, nao prioridade.
- `Ignore` (<5) — nao mostrar em destaque.

## Formato de saida (JSON ESTRITO)

```json
{
  "nota": 9.2,
  "veredito": "Foca",
  "resumo": "Texto curto (<=280 chars) descrevendo o que eh a novidade.",
  "justificativa": "Por que essa nota, citando termos do perfil que casaram.",
  "cite": "_perfil.md"
}
```

Nao inclua prosa antes ou depois do JSON. Nao use markdown no JSON. Nota eh numero com 1 casa decimal (9.2, nao "9.2" nem 9).

## Exemplos few-shot

### Exemplo 1 — Match forte com foco_ativo

Perfil:
```yaml
foco_ativo: [Claude Agent SDK, Managed Agents, MCP]
identidade: [SaaS B2B, Founder, Next.js]
evita: [geracao de video, voice cloning]
```

Novidade:
```json
{"titulo": "Claude Agent SDK 1.0", "resumo_bruto": "Stable APIs for tool orchestration and streaming.", "data": "2026-04-17"}
```

Saida esperada:
```json
{"nota": 9.4, "veredito": "Foca", "resumo": "Claude Agent SDK 1.0 com APIs estaveis pra orquestracao de tools e streaming.", "justificativa": "Match literal com foco_ativo 'Claude Agent SDK'. Usuario esta ativamente construindo nesse SDK (ver corpo do _perfil.md).", "cite": "_perfil.md"}
```

### Exemplo 2 — Match com evita

Perfil (mesmo acima).

Novidade:
```json
{"titulo": "Runway Gen-4: video generation breakthrough", "resumo_bruto": "New video model beats Sora.", "data": "2026-04-20"}
```

Saida esperada:
```json
{"nota": 2.5, "veredito": "Ignore", "resumo": "Runway lanca Gen-4, novo modelo de geracao de video.", "justificativa": "Match com evita 'geracao de video'. Usuario explicitou que nao quer ver esse tipo de novidade.", "cite": "_perfil.md"}
```
