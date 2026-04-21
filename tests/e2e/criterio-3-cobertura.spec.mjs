// Criterio 3 — "Tino cobre o terreno que importa."
// No modo demo, pelo menos 8 cards sao renderizados somando Focar + Considerar + Ignorar.

import { test, expect } from '@playwright/test';

test.describe('criterio 3 · cobertura', () => {
  test('pelo menos 8 cards renderizados no total', async ({ page }) => {
    await page.goto('/dashboard.html?mock=1');

    const todayView = page.locator('#today.view.active');
    await expect(todayView).toBeVisible();

    const allCards = todayView.locator('.cards > article.card');
    // Espera explicita para garantir que o render populou o DOM
    await expect(allCards.first()).toBeVisible();

    const total = await allCards.count();
    expect(total).toBeGreaterThanOrEqual(8);
  });
});
