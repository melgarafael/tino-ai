// Playwright config — Tino E2E suite.
// Sobe um python http.server 3 na porta 5174 apontando pra raiz do repo,
// serve o dashboard.html estatico. Nao depende de nenhum servidor pre-existente.

import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.TINO_E2E_PORT || 5174);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    cwd: __dirname,
    url: `http://localhost:${PORT}/dashboard.html`,
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
