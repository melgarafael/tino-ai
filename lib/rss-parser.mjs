// lib/rss-parser.mjs
// Parser de feeds RSS 2.0 e Atom → shape canonico do Tino.
//
// API:
//   parseFeed(xmlText) → { items: [{ id, titulo, url, data, resumo_bruto, fonte_interna }] }
//
// Detecta RSS vs Atom pela raiz do documento.
// Robustez:
//   - Tolera itens parcialmente quebrados (sem titulo/sem link) — pula esses.
//   - Normaliza datas para ISO 8601; se nao parsear, deixa string original.
//   - Strip HTML do resumo com regex simples.
//   - Fallback de id: guid/id → link → hash(titulo+url).

import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: '#text',
});

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toIso(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
}

function hashId(parts) {
  const h = createHash('sha1');
  h.update(parts.filter(Boolean).join('|'));
  return `sha1:${h.digest('hex').slice(0, 16)}`;
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    if (typeof node['#text'] === 'string') return node['#text'];
    if (typeof node['#text'] === 'number') return String(node['#text']);
  }
  return '';
}

function parseRssItem(item) {
  const titulo = stripHtml(textOf(item.title));
  const url = textOf(item.link) || (item.guid && typeof item.guid === 'object' && item.guid['@_isPermaLink'] !== 'false' ? textOf(item.guid) : '');
  const desc = textOf(item.description) || textOf(item['content:encoded']);
  const resumo_bruto = stripHtml(desc);
  const data = toIso(textOf(item.pubDate) || textOf(item.date) || textOf(item['dc:date']));

  let guid = '';
  if (item.guid) {
    guid = typeof item.guid === 'string' ? item.guid : textOf(item.guid);
  }
  const id = guid || url || hashId([titulo, url, data]);

  if (!titulo && !url) return null;

  return {
    id: String(id),
    titulo,
    url: String(url || ''),
    data,
    resumo_bruto,
    fonte_interna: 'rss',
  };
}

function parseAtomEntry(entry) {
  const titulo = stripHtml(textOf(entry.title));

  // link pode ser array de objetos com @_href, ou string.
  let url = '';
  const links = asArray(entry.link);
  for (const l of links) {
    if (typeof l === 'string') { url = l; break; }
    if (l && typeof l === 'object') {
      const rel = l['@_rel'] || 'alternate';
      if (rel === 'alternate' && l['@_href']) { url = l['@_href']; break; }
    }
  }
  if (!url && links.length > 0) {
    const first = links[0];
    if (first && typeof first === 'object' && first['@_href']) url = first['@_href'];
  }

  const summary = textOf(entry.summary) || textOf(entry.content);
  const resumo_bruto = stripHtml(summary);
  const data = toIso(textOf(entry.updated) || textOf(entry.published));

  const atomId = textOf(entry.id);
  const id = atomId || url || hashId([titulo, url, data]);

  if (!titulo && !url) return null;

  return {
    id: String(id),
    titulo,
    url: String(url || ''),
    data,
    resumo_bruto,
    fonte_interna: 'atom',
  };
}

export function parseFeed(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return { items: [] };

  let doc;
  try {
    doc = parser.parse(xmlText);
  } catch {
    return { items: [] };
  }
  if (!doc || typeof doc !== 'object') return { items: [] };

  // RSS 2.0: <rss><channel><item>
  if (doc.rss && doc.rss.channel) {
    const rawItems = asArray(doc.rss.channel.item);
    const items = [];
    for (const it of rawItems) {
      try {
        const parsed = parseRssItem(it);
        if (parsed) items.push(parsed);
      } catch {
        // skip broken item
      }
    }
    return { items };
  }

  // Atom: <feed><entry>
  if (doc.feed) {
    const rawEntries = asArray(doc.feed.entry);
    const items = [];
    for (const en of rawEntries) {
      try {
        const parsed = parseAtomEntry(en);
        if (parsed) items.push(parsed);
      } catch {
        // skip broken entry
      }
    }
    return { items };
  }

  // RDF (RSS 1.0) fallback: <rdf:RDF><item>
  if (doc['rdf:RDF'] && doc['rdf:RDF'].item) {
    const rawItems = asArray(doc['rdf:RDF'].item);
    const items = [];
    for (const it of rawItems) {
      try {
        const parsed = parseRssItem(it);
        if (parsed) items.push(parsed);
      } catch {}
    }
    return { items };
  }

  return { items: [] };
}
