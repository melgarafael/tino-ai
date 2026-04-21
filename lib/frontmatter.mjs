// lib/frontmatter.mjs
// Parser/serializer YAML frontmatter simples (sem deps externas).
// Espelha a lógica do dashboard.html, reescrita para uso no Node.
//
// Formato aceito:
//   ---
//   chave: valor
//   lista: [a, b, c]
//   flag: true
//   nota: 9.4
//   ---
//   corpo markdown aqui
//
// Tipos suportados: string, number (int/decimal), boolean, array inline.

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Número: inteiro ou decimal, com sinal opcional.
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // String entre aspas simples/duplas: tira aspas de borda.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseArray(raw) {
  // raw é o conteúdo entre `[` e `]`.
  if (raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseScalar(s));
}

export function parse(text) {
  const src = String(text ?? '');
  const m = src.match(FENCE);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    if (!k) return;
    const rawV = line.slice(idx + 1).trim();
    if (rawV.startsWith('[') && rawV.endsWith(']')) {
      meta[k] = parseArray(rawV.slice(1, -1));
    } else {
      meta[k] = parseScalar(rawV);
    }
  });
  return { meta, body: m[2] ?? '' };
}

function needsQuote(s) {
  if (typeof s !== 'string') return false;
  // Quote quando tem vírgula, colchetes, dois-pontos ou começa/termina com whitespace.
  return /[,:\[\]]/.test(s) || /^\s|\s$/.test(s);
}

function serializeValue(v) {
  if (Array.isArray(v)) {
    const parts = v.map((x) => {
      if (typeof x === 'string' && needsQuote(x)) return `"${x}"`;
      return String(x);
    });
    return `[${parts.join(', ')}]`;
  }
  if (typeof v === 'string' && needsQuote(v)) return `"${v}"`;
  return String(v);
}

export function serialize(meta, body) {
  const entries = Object.entries(meta || {});
  const lines = entries.map(([k, v]) => `${k}: ${serializeValue(v)}`);
  const fm = `---\n${lines.join('\n')}\n---`;
  const b = body ?? '';
  return `${fm}\n\n${b}`;
}
