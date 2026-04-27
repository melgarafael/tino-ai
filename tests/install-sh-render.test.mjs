import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../lib/install-sh-render.mjs';

test('render: bash valido com shebang + set + items', () => {
  const items = [
    { name: 'context7', kind: 'mcp', install: 'claude mcp add context7 X' },
    { name: 'superpowers', kind: 'plugin', install: '/plugin install superpowers' },
  ];
  const sh = render(items);
  assert.ok(sh.startsWith('#!/usr/bin/env bash'));
  assert.ok(sh.includes('set -euo pipefail'));
  assert.ok(sh.includes('claude mcp add context7 X'));
  assert.ok(sh.includes('/plugin install superpowers'));
  assert.ok(/\[1\/2\]/.test(sh) || sh.includes('Installing context7'));
});

test('render --interactive: inclui prompt yes/no por item', () => {
  const items = [{ name: 'a', kind: 'mcp', install: 'cmd' }];
  const sh = render(items, { interactive: true });
  assert.ok(sh.includes('--interactive'));
  assert.ok(/read|prompt|continue/i.test(sh), 'esperava interatividade');
});

test('render: 0 items retorna script no-op', () => {
  const sh = render([]);
  assert.ok(sh.startsWith('#!/usr/bin/env bash'));
  assert.ok(sh.includes('No items to install'));
});
