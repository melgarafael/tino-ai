// tests/rss-parser.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../lib/rss-parser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, 'fixtures', 'rss');

async function read(name) {
  return fs.readFile(path.join(FIX, name), 'utf8');
}

test('parseFeed: RSS 2.0 com 3 items → 3 items com schema completo', async () => {
  const xml = await read('anthropic-sample.xml');
  const { items } = parseFeed(xml);
  assert.equal(items.length, 3);

  const titles = items.map((i) => i.titulo);
  assert.ok(titles.includes('Claude Managed Agents GA'));
  assert.ok(titles.includes('Claude Agent SDK 1.0'));
  assert.ok(titles.includes('MCP new spec'));

  for (const it of items) {
    assert.equal(typeof it.id, 'string');
    assert.ok(it.id.length > 0, 'id nao vazio');
    assert.equal(typeof it.titulo, 'string');
    assert.ok(it.titulo.length > 0, 'titulo nao vazio');
    assert.equal(typeof it.url, 'string');
    assert.ok(it.url.startsWith('https://'), 'url http(s)');
    assert.equal(typeof it.data, 'string');
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(it.data), 'data ISO 8601');
    assert.equal(typeof it.resumo_bruto, 'string');
    assert.equal(it.fonte_interna, 'rss');
  }
});

test('parseFeed: RSS strip HTML do resumo', async () => {
  const xml = await read('anthropic-sample.xml');
  const { items } = parseFeed(xml);
  const managed = items.find((i) => i.titulo === 'Claude Managed Agents GA');
  assert.ok(managed);
  assert.doesNotMatch(managed.resumo_bruto, /<p>|<strong>/);
  assert.match(managed.resumo_bruto, /durable state/);
});

test('parseFeed: Atom com 2 entries → 2 items normalizados', async () => {
  const xml = await read('atom-sample.xml');
  const { items } = parseFeed(xml);
  assert.equal(items.length, 2);

  for (const it of items) {
    assert.equal(it.fonte_interna, 'atom');
    assert.ok(it.titulo.length > 0);
    assert.ok(it.url.startsWith('https://simonwillison.net/'));
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(it.data));
  }
});

test('parseFeed: Atom strip HTML do summary', async () => {
  const xml = await read('atom-sample.xml');
  const { items } = parseFeed(xml);
  const first = items[0];
  assert.doesNotMatch(first.resumo_bruto, /<p>|<em>/);
  assert.match(first.resumo_bruto, /practical/);
});

test('parseFeed: malformado nao explode, retorna items validos', async () => {
  const xml = await read('malformed.xml');
  const { items } = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, 'Valid item with title and link');
  assert.equal(items[0].url, 'https://example.com/valid');
});

test('parseFeed: xml vazio/invalido retorna items []', () => {
  assert.deepEqual(parseFeed(''), { items: [] });
  assert.deepEqual(parseFeed(null), { items: [] });
  assert.deepEqual(parseFeed('<not-a-feed/>'), { items: [] });
});
