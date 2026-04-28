import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBox, stripAnsi } from '../hooks/lib/visual-output.mjs';

test('renderBox: produz output com bordas e titulo', () => {
  const out = renderBox({ title: 'Tino [test]', lines: ['linha 1', 'linha 2'], emoji: '💭', mode: 'ativa' });
  assert.ok(out.includes('Tino [test]'));
  assert.ok(out.includes('linha 1'));
  assert.ok(out.includes('linha 2'));
  assert.ok(out.includes('Modo: ativa'));
  assert.ok(out.includes('╭') && out.includes('╰'));
});

test('renderBox: NO_COLOR remove escape codes', () => {
  const oldNoColor = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  try {
    const out = renderBox({ title: 'X', lines: ['hello'], emoji: '✓' });
    assert.equal(stripAnsi(out), out, 'output ja deveria estar sem ANSI');
  } finally {
    if (oldNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = oldNoColor;
  }
});

test('renderBox: linhas longas sao quebradas (wrap)', () => {
  const longLine = 'a'.repeat(100);
  const out = renderBox({ title: 'X', lines: [longLine], emoji: '!' });
  // Deve haver mais de uma linha de body
  const bodyLines = out.split('\n').filter((l) => l.includes('a'.repeat(10)));
  assert.ok(bodyLines.length >= 2, 'esperava pelo menos 2 linhas de wrap');
});
