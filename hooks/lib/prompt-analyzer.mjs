// hooks/lib/prompt-analyzer.mjs
//
// Heuristicas puras pra detectar prompt preguicoso ou loop "tenta de novo".
// Sem I/O, sem deps externas. Hot path do hook — manter rapido.

const VAGUE_ONLY = /^(isso|aquilo|esse(?:\s+troço)?|tipo\s+assim|aí|ne|né|você\s+sabe)\.?$/i;
const CLAUDE_COMMAND = /^\//;
const WHITELIST = /^(ok|sim|nao|não|prossiga|continue|skip|cancela|cancelar|abort|stop|para|pare)\.?$/i;
const QUESTION_STARTERS = /^(como|qual|quando|onde|por\s*que|porqu[eê]|quem|o\s*que|por\s*onde)\b/i;
const ERROR_LINE = /\b(at\s+\w+|Error:|Exception:|Traceback|stack:|TypeError|ReferenceError|SyntaxError)\b/;

const RETRY_PATTERN = /\b(tenta\s+(de\s+novo|outra\s+vez|novamente|aí)?|refaz|de\s+novo|tenta\s+outra\s+vez)\b/i;

export function analyzeLazy(prompt) {
  const reasons = [];
  const trimmed = (prompt || '').trim();

  // Whitelist primeiro (saida rapida)
  if (CLAUDE_COMMAND.test(trimmed)) return ok();
  if (WHITELIST.test(trimmed)) return ok();

  // Vague-only
  if (VAGUE_ONLY.test(trimmed)) {
    reasons.push('prompt vago sem referente — diga o que voce quer');
    return result(reasons);
  }

  // Curto sem ser pergunta clara
  if (trimmed.length < 30 && !isClearQuestion(trimmed)) {
    reasons.push('prompt muito curto e sem contexto — descreva o objetivo + o resultado esperado');
  }

  // Error paste sem pergunta
  if (looksLikeErrorPaste(trimmed)) {
    reasons.push('parece error paste sem pergunta — o que voce quer fazer com isso?');
  }

  return result(reasons);
}

export function analyzeStuck(prompt, recentHistory = []) {
  const reasons = [];
  const trimmed = (prompt || '').trim();
  const lower = trimmed.toLowerCase();

  // Padrao "tenta de novo" curto
  if (RETRY_PATTERN.test(trimmed) && trimmed.length < 80) {
    reasons.push('padrao "tenta de novo" sem novo contexto — explique o que mudou desde a ultima tentativa');
  }

  // Repeticao literal
  const recent = recentHistory.slice(0, 3);
  const repetitions = recent.filter((h) => (h.prompt || '').trim().toLowerCase() === lower).length;
  if (repetitions >= 1) {
    reasons.push(`prompt identico ja enviado ${repetitions}x recentemente — pause e reformule com nova info`);
  }

  // Repeticao de fragmento de erro
  if (containsRepeatedErrorFragment(trimmed, recentHistory.slice(0, 5))) {
    reasons.push('mesmo erro repetido em prompts anteriores — entrar em loop eh sinal de pausar');
  }

  return { ...result(reasons), repetitions };
}

// ===== helpers =====

function isClearQuestion(s) {
  return s.endsWith('?') || QUESTION_STARTERS.test(s);
}

function looksLikeErrorPaste(s) {
  const lines = s.split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  const errorLines = lines.filter((l) => ERROR_LINE.test(l)).length;
  const hasQuestion = s.includes('?');
  return errorLines >= 1 && !hasQuestion;
}

function containsRepeatedErrorFragment(prompt, history) {
  // Extrair 1 fragmento ≥ 10 chars do prompt; checar se aparece em history
  const lines = prompt.split('\n').filter((l) => l.trim().length >= 10);
  if (lines.length === 0) return false;
  const fragment = lines[0].trim().slice(0, 50);
  return history.some((h) => (h.prompt || '').includes(fragment));
}

function ok() {
  return { flagged: false, reasons: [], severity: 'none' };
}

function result(reasons) {
  if (reasons.length === 0) return ok();
  const severity = reasons.length >= 2 ? 'high' : 'med';
  return { flagged: true, reasons, severity };
}
