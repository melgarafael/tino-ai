// hooks/lib/visual-output.mjs
//
// Render de boxes ANSI pra output visual dos hooks.
// Suporta NO_COLOR + TERM=dumb fallback (texto plano).

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s) {
  return s.replace(ANSI_RE, '');
}

function noColorMode() {
  return !!process.env.NO_COLOR || process.env.TERM === 'dumb';
}

function colorize(s, color) {
  if (noColorMode()) return s;
  const code = ANSI[color] || '';
  return `${code}${s}${ANSI.reset}`;
}

function dim(s) {
  if (noColorMode()) return s;
  return `${ANSI.dim}${s}${ANSI.reset}`;
}

function wrap(line, width) {
  if (line.length <= width) return [line];
  const out = [];
  let remaining = line;
  while (remaining.length > width) {
    let cutAt = width;
    const space = remaining.lastIndexOf(' ', width);
    if (space > width / 2) cutAt = space;
    out.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining.length > 0) out.push(remaining);
  return out;
}

export function renderBox({ title, lines = [], color = 'yellow', emoji = '💭', mode = null, width = 60 }) {
  const innerW = width - 4; // 2 chars border + 2 padding
  const titleStr = `${emoji} ${title}`;
  const titlePadded = ` ${titleStr} `;
  const dashCount = Math.max(2, width - 2 - titlePadded.length);
  const top = colorize(`╭─${titlePadded}${'─'.repeat(dashCount)}╮`, color);
  const bot = colorize(`╰${'─'.repeat(width - 2)}╯`, color);
  const empty = `${colorize('│', color)} ${' '.repeat(innerW)} ${colorize('│', color)}`;

  const bodyLines = lines.flatMap((l) => wrap(l, innerW));
  const bodyRendered = bodyLines.map((l) => `${colorize('│', color)} ${l.padEnd(innerW)} ${colorize('│', color)}`);

  const modeFixed = mode
    ? (() => {
        const text = `Modo: ${mode}`;
        const padded = text.padEnd(innerW);
        return [`${colorize('│', color)} ${dim(padded)} ${colorize('│', color)}`];
      })()
    : [];

  return [top, empty, ...bodyRendered, ...modeFixed, empty, bot].join('\n');
}
