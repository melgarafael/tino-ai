// lib/rank-mock.mjs
// Ranker mock deterministico — heuristica de keyword matching contra o perfil.
//
// API:
//   rankMock(perfil, novidade, ajustes = []) -> { nota, veredito, resumo, justificativa, cite }
//
// Entradas:
//   - perfil: objeto com `.meta` (frontmatter parseado) contendo `foco_ativo`,
//     `identidade`, `evita` (arrays de strings). `.body` e opcional.
//   - novidade: item do cache com `titulo`, `resumo_bruto`, `data`, `url`, `fonte`.
//   - ajustes: array opcional de objetos `{ ignore_tags: [...] }` parseados do
//     `_ajustes.md` do vault. Cada match de tag em titulo/resumo aplica -2.
//
// Score base = 5.0. Bonus/penalties:
//   - foco_ativo match  : +3.0 por termo (cap +6.0)
//   - identidade match  : +1.5 por termo (cap +3.0)
//   - evita match       : -4.0 por termo (sem cap)
//   - ignore_tags match : -2.0 por tag distinta
//   - recencia (<=7 dias): +1.0
// Clip final em [0, 10], arredondado a 1 casa.
//
// Veredito por threshold:
//   >= 9  -> 'Foca'
//   >= 7  -> 'Considera'
//   >= 5  -> 'Acompanha'
//   <  5  -> 'Ignore'
//
// Justificativa explicita: lista termos que casaram + cita `_perfil.md` por default.
// cite: caminho do arquivo que motivou (default `_perfil.md`).

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerm(haystack, term) {
  if (!term) return false;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(term)}([^\\p{L}\\p{N}_]|$)`, 'iu');
  return pattern.test(haystack);
}

function asTermArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim().length > 0);
  if (typeof v === 'string' && v.trim().length > 0) return [v];
  return [];
}

function isRecent(dataIso, nowMs = Date.now(), windowDays = 7) {
  if (!dataIso) return false;
  const t = Date.parse(dataIso);
  if (Number.isNaN(t)) return false;
  return (nowMs - t) <= windowDays * DAY_MS && (nowMs - t) >= -DAY_MS; // tolera skew de 1 dia futuro
}

function roundOne(n) {
  return Math.round(n * 10) / 10;
}

function clip(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function verdictFor(nota) {
  if (nota >= 9) return 'Foca';
  if (nota >= 7) return 'Considera';
  if (nota >= 5) return 'Acompanha';
  return 'Ignore';
}

function collectIgnoreTags(ajustes) {
  const set = new Set();
  const list = Array.isArray(ajustes) ? ajustes : (ajustes ? [ajustes] : []);
  for (const a of list) {
    if (!a) continue;
    const tags = asTermArray(a.ignore_tags);
    for (const t of tags) set.add(t);
  }
  return [...set];
}

export function rankMock(perfil, novidade, ajustes = []) {
  const meta = (perfil && perfil.meta) || {};
  const focoAtivo = asTermArray(meta.foco_ativo);
  const identidade = asTermArray(meta.identidade);
  const evita = asTermArray(meta.evita);
  const ignoreTags = collectIgnoreTags(ajustes);

  const titulo = String(novidade?.titulo || '');
  const resumo = String(novidade?.resumo_bruto || '');
  const hay = `${titulo}\n${resumo}`;

  const focoMatches = focoAtivo.filter((t) => hasTerm(hay, t));
  const identMatches = identidade.filter((t) => hasTerm(hay, t));
  const evitaMatches = evita.filter((t) => hasTerm(hay, t));
  const tagMatches = ignoreTags.filter((t) => hasTerm(hay, t));

  const focoBonus = Math.min(focoMatches.length * 3.0, 6.0);
  const identBonus = Math.min(identMatches.length * 1.5, 3.0);
  const evitaPenalty = evitaMatches.length * 4.0;
  const tagPenalty = tagMatches.length * 2.0;
  const recencyBonus = isRecent(novidade?.data) ? 1.0 : 0.0;

  const raw = 5.0 + focoBonus + identBonus + recencyBonus - evitaPenalty - tagPenalty;
  const nota = roundOne(clip(raw, 0, 10));
  const veredito = verdictFor(nota);

  const resumoOut = resumo
    ? (resumo.length > 280 ? `${resumo.slice(0, 277)}...` : resumo)
    : titulo;

  const motivos = [];
  if (focoMatches.length) motivos.push(`foco_ativo: ${focoMatches.join(', ')}`);
  if (identMatches.length) motivos.push(`identidade: ${identMatches.join(', ')}`);
  if (evitaMatches.length) motivos.push(`evita: ${evitaMatches.join(', ')}`);
  if (tagMatches.length) motivos.push(`ignore_tags: ${tagMatches.join(', ')}`);
  if (recencyBonus) motivos.push('recencia (<=7d)');

  const base = motivos.length
    ? `Match heuristico contra _perfil.md — ${motivos.join('; ')}.`
    : 'Sem matches diretos no perfil — score neutro.';
  const justificativa = `${base} Baseado em match heuristico deterministico (mock), sem LLM.`;

  return {
    nota,
    veredito,
    resumo: resumoOut,
    justificativa,
    cite: '_perfil.md',
  };
}
