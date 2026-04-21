// Criterio 4 — "Tino explica por que algo importa PARA VOCE."
// Expandir um card em "Focar" revela bloco .reason com label "Por que importa" e um .cite.

import { test, expect } from '@playwright/test';

test.describe('criterio 4 · justificativa personalizada', () => {
  test('expandir card revela reason com label e cite', async ({ page }) => {
    await page.goto('/dashboard.html');

    const todayView = page.locator('#today.view.active');
    await expect(todayView).toBeVisible();

    const focarHead = todayView.locator('.section-head').filter({ hasText: /Focar/i }).first();
    await expect(focarHead).toBeVisible();

    // Primeiro card de Focar
    const firstCard = focarHead.locator('xpath=following-sibling::div[contains(@class,"cards")][1]/article[contains(@class,"card")][1]');
    await expect(firstCard).toBeVisible();

    // Antes do clique, .expand esta escondido
    const expand = firstCard.locator('.expand');
    await expect(expand).toBeHidden();

    // Clica no card (evitando a area de action)
    await firstCard.locator('h3').click();

    // Classe expanded aplicada
    await expect(firstCard).toHaveClass(/expanded/);

    // .expand agora visivel
    await expect(expand).toBeVisible();

    // Bloco .reason com label "Por que importa"
    const reason = firstCard.locator('.reason');
    await expect(reason).toBeVisible();
    await expect(reason.locator('.label')).toContainText(/por que importa/i);

    // .cite presente e com conteudo (aponta para arquivo do vault)
    const cite = reason.locator('.cite');
    await expect(cite).toBeVisible();
    await expect(cite).toContainText(/\S/); // algum conteudo
  });
});
