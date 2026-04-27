// lib/stack-resolver.mjs
//
// Resolve curated-stack contra um perfil vibecoder.
// Pure function. Sem deps externas.

const KIND_TO_INSTALLED = {
  skill: 'skills',
  agent: 'agents',
  command: 'commands',
  hook: 'hooks',
  mcp: 'mcps',
  plugin: 'plugins',
};

export function resolve(perfil, curatedStack) {
  const sources = [
    { section: 'essentials', items: curatedStack.essentials || [] },
    { section: 'by_role', items: curatedStack.by_role?.[perfil.papel] || [] },
    { section: 'by_plan', items: curatedStack.by_plan?.[perfil.plano_claude] || [] },
  ];

  // Combine + dedupe by name (first occurrence wins)
  const combined = [];
  const seen = new Set();
  for (const src of sources) {
    for (const item of src.items) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      combined.push({ ...item, source_section: src.section });
    }
  }

  // Filter ja_tem_instalado
  const installed = perfil.ja_tem_instalado || {};
  const isInstalled = (item) => {
    const list = installed[KIND_TO_INSTALLED[item.kind]] || [];
    return list.includes(item.name);
  };
  const filtered = combined.filter((it) => !isInstalled(it));

  // Apply incompatible (first kept, others dropped)
  const incompatible = curatedStack.incompatible || [];
  const items = [];
  const dropped = [];
  const skipped = new Set();

  for (const item of filtered) {
    if (skipped.has(item.name)) continue;

    items.push(item);

    for (const inc of incompatible) {
      if (inc.items?.includes(item.name)) {
        for (const other of inc.items) {
          if (other === item.name || skipped.has(other)) continue;
          // Only drop if other is actually in the filtered list
          if (filtered.some((x) => x.name === other)) {
            skipped.add(other);
            dropped.push({ name: other, reason: inc.reason || '', kept: item.name });
          }
        }
      }
    }
  }

  return { items, dropped };
}
