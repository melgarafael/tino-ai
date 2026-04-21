// Criterio 1 — "Tino reduz consumo, nao aumenta."
// No modo demo, a secao "Focar hoje" tem no maximo 5 cards (nota >= 9)
// e o texto calmo "voce esta em dia" aparece com contagem.

import { test, expect } from '@playwright/test';

test.describe('criterio 1 · reduz consumo', () => {
  test('secao Focar tem no maximo 5 cards e calm copy aparece', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Espera a view "Hoje" estar ativa e renderizada
    const todayView = page.locator('#today.view.active');
    await expect(todayView).toBeVisible();

    // Bloco de calm copy com "voce esta em dia"
    const calm = todayView.locator('.calm');
    await expect(calm).toBeVisible();
    await expect(calm).toContainText(/em dia/i);

    // Localiza o heading "Focar" dentro de #today
    const focarHead = todayView.locator('.section-head').filter({ hasText: /Focar/i }).first();
    await expect(focarHead).toBeVisible();

    // Os cards que seguem esse heading vivem no .cards imediatamente apos
    const focarCards = focarHead.locator('xpath=following-sibling::div[contains(@class,"cards")][1]/article[contains(@class,"card")]');
    const count = await focarCards.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });
});
