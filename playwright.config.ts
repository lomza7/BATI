import { defineConfig, devices } from '@playwright/test';

/*
 * Playwright config — E2E Hellobat.
 *
 * Viewport par défaut : mobile (iPhone 13) — cohérent avec la politique
 * mobile-first du produit (artisans sur chantier). Un projet "desktop"
 * secondaire est défini pour valider les flows qui ont un comportement
 * desktop-spécifique.
 *
 * Base URL : utilise PLAYWRIGHT_BASE_URL si défini, sinon localhost:3000
 * (nécessite `npm run dev` à côté). En CI, `webServer` démarre Next.
 *
 * Les 3 flows dorés (auth-onboarding, devis-signature, invoice-payment)
 * sont stubbés avec `test.skip(...)` tant que les credentials de test ne
 * sont pas fournis. Voir `tests/e2e/README.md`.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // En CI on démarre Next nous-mêmes ; en local on assume que le dev
  // server est déjà lancé pour éviter de doubler le coût de démarrage.
  webServer: IS_CI
    ? {
        command: 'npm run build && npm run start',
        url: BASE_URL,
        timeout: 180_000,
        reuseExistingServer: false,
      }
    : undefined,
});
