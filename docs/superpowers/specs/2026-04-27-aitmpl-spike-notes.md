# Spike — aitmpl.com formato de dados

**Data:** 2026-04-27
**Pra quê:** decisão entre fetch JSON puro vs HTML scraping no `lib/aitmpl-client.mjs`

## Endpoints encontrados

Inspeção via `curl` (apex `aitmpl.com` redireciona 308 -> `www.aitmpl.com`, server: Vercel).

| Endpoint | Status final | Content-Type | Observação |
|---|---|---|---|
| `/` | 200 | `text/html; charset=utf-8` | Página estática (~55 KB). Contém `<script type="application/ld+json">` apenas com metadados SEO (Organization/WebSite). Catálogo é renderizado client-side. |
| `/components.json` | **200** | **`application/json; charset=utf-8`** | **Catálogo completo (~15 MB). Contém TODO o conteúdo de cada item embutido.** |
| `/api`, `/api/skills`, `/api/agents`, `/api/catalog`, `/api/components`, `/api/v1` | 404 | `text/plain` | Não existem rotas `/api/*`. |
| `/catalog.json`, `/components-data.json`, `/data.json` | 404 | `text/plain` | Variações que tentei — só `/components.json` responde. |
| `/sitemap.xml` | 404 | `text/plain` | Sem sitemap. |

### Estrutura de `/components.json`

Top-level: 10 chaves (`agents`, `commands`, `mcps`, `settings`, `hooks`, `sandbox`, `skills`, `templates`, `plugins`, `componentsMarketplace`).

Tamanhos atuais:
- `skills`: 808 itens
- `agents`: 419 itens
- `commands`: 281 itens
- `mcps`: 84 itens
- `settings`: 67 itens
- `hooks`: 56 itens
- `sandbox`: 11 itens
- `templates`: 14 itens
- `plugins`: 0 itens (vazio hoje)
- `componentsMarketplace`: objeto (metadados)

Cada item (exceto `templates`) tem o mesmo schema:

```
{
  "name":        string,                // ex: "ai-ethics-advisor"
  "path":        string,                // ex: "ai-specialists/ai-ethics-advisor.md"
  "category":    string,                // ex: "ai-specialists"
  "type":        "agent"|"skill"|...    // = nome da chave singular
  "content":     string,                // markdown completo (frontmatter + body)
  "description": string,                // texto livre, geralmente vem do frontmatter
  "author":      string,
  "repo":        string,                // URL do repo origem
  "version":     string,
  "license":     string,
  "keywords":    string[],
  "downloads":   number,
  "security":    object,
  "references":  string[]               // só em skills
}
```

`templates` tem schema próprio (`id`, `subtype`, `language`, `files`, `installCommand`, `downloads`).

## Decisão: **fetch direto JSON**

Um único `GET https://aitmpl.com/components.json` retorna todo o catálogo (skills, agents, MCPs, hooks, plugins, settings, sandbox, templates) com `content` markdown completo embutido em cada item. Não precisamos:

- Iterar páginas HTML.
- Parsear `__NEXT_DATA__` ou `application/ld+json`.
- Adicionar `cheerio`.

O `lib/aitmpl-client.mjs` faz `fetch` JSON puro + cache em disco. `fetchCatalog(kind)` filtra `data[kind]`; `fetchItem(kind, name)` faz `data[kind].find(x => x.name === name)`. Sem necessidade de N requests por item — o catalog inteiro já vem.

## Se scraping HTML: estrutura observada

N/A — decisão é fetch JSON. (Se em algum momento futuro `/components.json` sumir, fallback seria scrape do `<script>` client-side, mas o projeto declara `aitmpl-client` resiliente a falha — degrada para zero recomendações nesse caso.)

## Implicações pra Task 2 e Task 6

- **Task 2:** instalar **apenas `ajv`**. NÃO instalar `cheerio`.
- **Task 6:** `aitmpl-client.mjs` faz `fetch('https://aitmpl.com/components.json')` uma vez, cacheia em disco com TTL, e expõe `fetchCatalog(kind)`/`fetchItem(kind, name)`/`search(query)` operando sobre o objeto em memória. Mock server local serve uma cópia parcial do mesmo formato.
- **Risco:** payload é grande (~15 MB). Vale considerar um TTL de cache mais generoso (24h+) e talvez compressão/streaming. Não é problema pra Onda 0 — só preciso documentar.
- **Categorização:** o catálogo distingue `skills` de `agents` de `commands` etc, batendo 1:1 com o esquema do `_perfil-vibecoder.md` (`ja_tem_instalado.skills/agents/mcps/plugins/hooks`). Mapeamento direto.
