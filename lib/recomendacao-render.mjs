// lib/recomendacao-render.mjs
//
// Renderiza o markdown completo do _recomendacao.md a partir
// de items resolvidos + perfil + extras opcionais.

import { stringify as yamlStringify } from 'yaml';

export function render(items, perfil, extras = [], opts = {}) {
  const droppedList = opts.dropped || [];

  const taggedExtras = extras.map((e) => ({ ...e, source_section: 'extras_aitmpl' }));
  const all = [...items, ...taggedExtras];

  const counts = {
    total: all.length,
    essentials: all.filter((i) => i.source_section === 'essentials').length,
    by_role: all.filter((i) => i.source_section === 'by_role').length,
    by_plan: all.filter((i) => i.source_section === 'by_plan').length,
    extras_aitmpl: all.filter((i) => i.source_section === 'extras_aitmpl').length,
  };

  const fm = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    generated_for_perfil: 'Tino/_perfil-vibecoder.md',
    counts,
    items: all.map((i) => {
      const out = {
        name: i.name,
        kind: i.kind,
        source_section: i.source_section,
        install: i.install,
        why: i.why,
      };
      if (i.aitmpl_id) out.aitmpl_id = i.aitmpl_id;
      return out;
    }),
    incompatibilities_avoided: droppedList.map((d) => ({
      items: [d.name, d.kept],
      kept: d.kept,
      reason: d.reason,
    })),
  };

  const fmYaml = yamlStringify(fm).trim();

  const byKind = {};
  for (const item of all) {
    (byKind[item.kind] = byKind[item.kind] || []).push(item);
  }

  let body = '\n## O que isso instala\n\n';
  for (const [kind, list] of Object.entries(byKind)) {
    body += `**${kind}** (${list.length})\n`;
    for (const item of list) {
      body += `- ${item.name}\n`;
    }
    body += '\n';
  }

  body += '## Por que cada item\n\n';
  for (const item of all) {
    body += `**${item.name}** (${item.kind}) — ${item.why}\n\n`;
  }

  return `---\n${fmYaml}\n---\n${body}`;
}
