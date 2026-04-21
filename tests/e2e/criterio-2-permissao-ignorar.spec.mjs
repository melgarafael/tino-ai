// Criterio 2 — "Tino da permissao de ignorar."
// A secao "Ignorar por ora" existe com pelo menos 1 card e esse card tem a tag "Ignore".

import { test, expect } from '@playwright/test';

test.describe('criterio 2 · permissao de ignorar', () => {
  test('secao Ignorar por ora existe, tem cards e tag Ignore', async ({ page }) => {
    await page.goto('/dashboard.html');

    const todayView = page.locator('#today.view.active');
    await expect(todayView).toBeVisible();

    const ignorarHead = todayView.locator('.section-head').filter({ hasText: /Ignorar/i }).first();
    await expect(ignorarHead).toBeVisible();

    // Copy fala explicitamente que pode ignorar com tranquilidade
    const calm = todayView.locator('.calm');
    await expect(calm).toContainText(/ignorad/i);

    // Container .cards.ignored aparece apos o heading
    const ignoredCards = todayView.locator('.cards.ignored > article.card');
    const count = await ignoredCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Pelo menos um card tem a tag "Ignore" (pode ser "Ignore" no texto)
    const ignoreTag = ignoredCards.first().locator('.tag.ignore');
    await expect(ignoreTag).toBeVisible();
    await expect(ignoreTag).toContainText(/ignore/i);
  });
});
