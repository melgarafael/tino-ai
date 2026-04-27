// lib/recommender-pipeline.mjs
//
// Orquestra: parse curated → resolve perfil → opcional aitmpl extras → render.
// Usado pelo agent vibecoder-recommender e testavel em isolamento.

import { resolve as resolveStack } from './stack-resolver.mjs';
import { render } from './recomendacao-render.mjs';
import { parse as parseCurated } from './curated-stack.mjs';
import { search, AitmplUnavailableError } from './aitmpl-client.mjs';

export async function runPipeline({
  perfil,
  curatedStackPath,
  baseUrl,
  cacheDir,
  ttlMs,
  fetchExtras = true,
}) {
  const curated = parseCurated(curatedStackPath);
  const { items, dropped } = resolveStack(perfil, curated);

  let extras = [];
  if (fetchExtras) {
    extras = await tryFetchExtras(perfil, items, { baseUrl, cacheDir, ttlMs });
  }

  return render(items, perfil, extras, { dropped });
}

async function tryFetchExtras(perfil, alreadyChosen, opts) {
  const queries = []
    .concat(perfil.linguagens_familiares || [])
    .concat(perfil.tipo_projeto || [])
    .slice(0, 3);

  if (queries.length === 0) return [];

  const seen = new Set(alreadyChosen.map((i) => i.name));
  const extras = [];

  for (const q of queries) {
    let found;
    try {
      found = await search(q, { ...opts, limit: 3 });
    } catch (e) {
      if (e instanceof AitmplUnavailableError) return extras; // graceful degrade
      throw e;
    }
    for (const it of found) {
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      extras.push({
        name: it.name,
        kind: it.type,
        install: it.install || `# manual: see https://aitmpl.com/${it.path || ''}`,
        why: it.description || `Sugestão automática (aitmpl) baseada em "${q}"`,
        aitmpl_id: it.name,
      });
    }
  }

  return extras;
}
