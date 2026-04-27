// lib/claude-md-template.mjs
//
// Renderiza CLAUDE.md customizado a partir do perfil vibecoder.
// Funcao pura. Sem deps externas.

export function render(perfil) {
  const sections = [];

  sections.push(header(perfil));
  sections.push(quemEstaNoComando(perfil));
  sections.push(oqueEstamosConstruindo(perfil));
  sections.push(comoInteragir(perfil));
  sections.push(principios(perfil));
  sections.push(quandoErrar(perfil));
  sections.push(referencias(perfil));

  return sections.join('\n\n');
}

function header(perfil) {
  const owner = perfil.nome ? perfil.nome : 'este projeto';
  return `# CLAUDE.md — ${owner}

> Gerado pelo Tino em ${new Date().toISOString().slice(0, 10)} a partir do seu perfil vibecoder. Editavel.`;
}

function quemEstaNoComando(perfil) {
  const who = perfil.nome || 'Eu';
  return `## Quem está no comando

${who} — ${perfil.papel}, experiência de dev: ${perfil.experiencia_dev}. Plano Claude: ${perfil.plano_claude}.`;
}

function oqueEstamosConstruindo(perfil) {
  const tipos = (perfil.tipo_projeto || []).join(', ');
  const stacks = (perfil.stacks_conhecidas || []).join(', ');
  const obj = perfil.objetivos_curto_prazo || '(não informado)';
  return `## O que estamos construindo

${obj}.

Tipo: ${tipos}. Stack: ${stacks || '—'}.`;
}

function comoInteragir(perfil) {
  const langs = (perfil.linguagens_familiares || []).join(', ') || '—';
  return `## Como interagir comigo

- **Modo de autonomia:** ${perfil.modo_autonomia} — ${explicaAutonomia(perfil.modo_autonomia)}
- **Tolerância a risco:** ${perfil.tolerancia_risco} — ${explicaRisco(perfil.tolerancia_risco)}
- **Linguagens que entendo:** ${langs}`;
}

function principios(perfil) {
  const bullets = [];
  if (['nenhuma', 'iniciante'].includes(perfil.experiencia_dev)) {
    bullets.push('Explique decisões em português antes de codar.');
  }
  if (perfil.tolerancia_risco === 'baixa') {
    bullets.push('Confirme antes de qualquer comando que apague arquivo (rm, delete, drop).');
  }
  if (perfil.modo_autonomia === 'perguntativo') {
    bullets.push('Apresente um plano curto antes de implementar mudanças não-triviais.');
  }
  if (bullets.length === 0) {
    bullets.push('Aja conforme o modo_autonomia configurado, mostrando o que faz.');
  }
  return `## Princípios não-negociáveis

${bullets.map((b) => `- ${b}`).join('\n')}`;
}

function quandoErrar(perfil) {
  const lines = [
    'Pare. Não tente "tentar de novo" sem nova spec.',
    'Identifique a causa raiz, não apenas o sintoma.',
  ];
  if (perfil.intervencao_hooks && perfil.intervencao_hooks !== 'silenciosa') {
    lines.push('Os hooks anti-burro/anti-preguiçoso do Tino vão te ajudar — escute eles.');
  }
  return `## Quando errar

${lines.map((l) => `- ${l}`).join('\n')}`;
}

function referencias(perfil) {
  return `## Referências do meu vault Obsidian

- Perfil vibecoder: \`{vault}/Tino/_perfil-vibecoder.md\`
- Recomendação atual: \`{vault}/Tino/_recomendacao.md\`
- Configuração Claude Code: \`~/.claude/settings.json\``;
}

function explicaAutonomia(m) {
  return ({
    perguntativo: 'pede confirmação pra quase tudo',
    balanceado: 'pergunta em ações destrutivas/grandes, faz o resto sozinho',
    autonomo: 'faz tudo, mostra o que fez',
  })[m] || '—';
}

function explicaRisco(r) {
  return ({
    baixa: 'bloqueia comandos destrutivos sem confirmação',
    media: 'bloqueia rm -rf, deixa o resto',
    alta: 'permissões abertas, confia',
  })[r] || '—';
}
