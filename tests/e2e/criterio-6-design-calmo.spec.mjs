// Criterio 6 — "Tino deve parecer biblioteca, nao feed."
// Valida o design calmo: fundo escuro, fonte editorial Newsreader, zero animacoes agressivas.

import { test, expect } from '@playwright/test';

function parseRgb(str) {
  const m = /rgba?\(([^)]+)\)/.exec(String(str || ''));
  if (!m) return null;
  const parts = m[1].split(',').map((s) => Number(s.trim()));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

test.describe('criterio 6 · design calmo', () => {
  test('bg escuro, fonte Newsreader aplicada, zero animacao agressiva', async ({ page }) => {
    await page.goto('/dashboard.html?mock=1');

    // Aguarda render
    await expect(page.locator('#today.view.active .calm')).toBeVisible();

    // --- BG do body escuro (mais escuro que rgb(30,30,30)) ---
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const rgb = parseRgb(bgColor);
    expect(rgb).not.toBeNull();
    // Cada canal < 30 garante "darker than rgb(30,30,30)"
    expect(rgb.r).toBeLessThan(30);
    expect(rgb.g).toBeLessThan(30);
    expect(rgb.b).toBeLessThan(30);

    // --- Fonte Newsreader carregada e aplicada ao .brand ---
    const brandFont = await page.evaluate(() => {
      const target = document.querySelector('.brand');
      return target ? getComputedStyle(target).fontFamily : '';
    });
    expect(brandFont.toLowerCase()).toContain('newsreader');

    // Newsreader tambem no heading calm
    const calmFont = await page.evaluate(() => {
      const target = document.querySelector('.calm p');
      return target ? getComputedStyle(target).fontFamily : '';
    });
    expect(calmFont.toLowerCase()).toContain('newsreader');

    // --- Zero classes ruidosas: sem shake/bounce/pulse em qualquer elemento ---
    const noisyClassCount = await page.locator('.shake, .bounce, .pulse, .flash, .spin').count();
    expect(noisyClassCount).toBe(0);

    // Sem badges de notificacao tipicos de feed
    const notifBadges = await page.locator('.badge-notification, .notification-dot, .unread-badge').count();
    expect(notifBadges).toBe(0);
  });
});
