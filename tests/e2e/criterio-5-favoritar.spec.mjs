// Criterio 5 — "Tino deixa voce salvar o que importa."
// Clicar Favoritar muda o botao para Favoritado (classe .active + prefixo estrela).
// A mudanca persiste no state observavel: contador de favoritos na aba sobe e
// o item aparece na view Favoritos.
//
// Nota sobre persistencia em reload: no modo demo o dashboard nao serializa em
// localStorage (a persistencia real vive no vault Obsidian, via File System Access
// API, inalcancavel em E2E headless). Este teste valida o contrato observavel:
// state atualiza em memoria, re-render reflete, e a view de Favoritos mostra o item.

import { test, expect } from '@playwright/test';

test.describe('criterio 5 · favoritar', () => {
  test('click em Favoritar marca como Favoritado e aparece na aba', async ({ page }) => {
    await page.goto('/dashboard.html?mock=1');

    const todayView = page.locator('#today.view.active');
    await expect(todayView).toBeVisible();

    const focarHead = todayView.locator('.section-head').filter({ hasText: /Focar/i }).first();
    const firstCard = focarHead.locator('xpath=following-sibling::div[contains(@class,"cards")][1]/article[contains(@class,"card")][1]');
    await expect(firstCard).toBeVisible();

    // Expande o card pra revelar o botao Favoritar
    await firstCard.locator('h3').click();
    await expect(firstCard).toHaveClass(/expanded/);

    // Antes: botao diz "Favoritar" e nao tem .active
    const favBtn = firstCard.locator('button.act.primary[data-fav]');
    await expect(favBtn).toBeVisible();
    await expect(favBtn).toHaveText(/Favoritar/i);
    await expect(favBtn).not.toHaveClass(/active/);

    // Conta favoritos antes
    const countBefore = await page.locator('#count-fav').textContent();

    // Clica Favoritar
    await favBtn.click();

    // Depois: o card re-renderiza. Busca pelo id do card pra pegar o novo botao.
    const cardId = await firstCard.getAttribute('data-id');
    expect(cardId).toBeTruthy();

    // Apos re-render, expande de novo pra inspecionar o botao atualizado
    const sameCard = page.locator(`article.card[data-id="${cardId}"]`).first();
    // Clica pra expandir (render fecha expansoes)
    await sameCard.locator('h3').click();
    await expect(sameCard).toHaveClass(/expanded/);

    const favBtnAfter = sameCard.locator('button.act.primary[data-fav]');
    await expect(favBtnAfter).toHaveText(/Favoritado/i);
    await expect(favBtnAfter).toHaveClass(/active/);

    // Contador da aba Favoritos subiu
    const countAfter = await page.locator('#count-fav').textContent();
    expect(Number(countAfter)).toBe(Number(countBefore) + 1);

    // Muda pra aba Favoritos e verifica que o card esta la
    await page.locator('.tab[data-view="favorites"]').click();
    const favView = page.locator('#favorites.view.active');
    await expect(favView).toBeVisible();
    await expect(favView.locator(`article.card[data-id="${cardId}"]`)).toBeVisible();
  });
});
