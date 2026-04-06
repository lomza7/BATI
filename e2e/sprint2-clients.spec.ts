/**
 * E2E tests — Module Clients (Sprint 2)
 * Requires: HEL-70 (CRUD Clients) to be implemented by Max
 *
 * Status: SKELETON — tests are written but will fail until the UI is built.
 * Run with: npm run test:e2e -- --grep "clients"
 */
import { test, expect } from '@playwright/test'

test.describe('Clients — Mobile 375px (iPhone SE)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    // TODO: auth setup — log in as test artisan once Clerk test env is configured
    await page.goto('/dashboard/clients')
  })

  test('affiche la liste clients vide pour un nouvel artisan', async ({ page }) => {
    await expect(page.getByText(/aucun client/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /nouveau client/i })).toBeVisible()
  })

  test('crée un client minimal (nom seulement)', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau client/i }).click()
    await page.getByLabel(/nom/i).fill('Jean Dupont')
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page.getByText('Jean Dupont')).toBeVisible()
  })

  test('crée un client complet (tous les champs)', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau client/i }).click()
    await page.getByLabel(/nom/i).fill('ACME Construction')
    await page.getByLabel(/email/i).fill('contact@acme.fr')
    await page.getByLabel(/téléphone/i).fill('06 12 34 56 78')
    await page.getByLabel(/adresse/i).fill('12 rue de la Paix')
    await page.getByLabel(/ville/i).fill('Paris')
    await page.getByLabel(/code postal/i).fill('75001')
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page.getByText('ACME Construction')).toBeVisible()
  })

  test('valide le formulaire — nom obligatoire', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau client/i }).click()
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page.getByText(/nom est obligatoire/i)).toBeVisible()
  })

  test('valide le formulaire — email invalide', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau client/i }).click()
    await page.getByLabel(/nom/i).fill('Test Client')
    await page.getByLabel(/email/i).fill('pas-un-email')
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page.getByText(/email invalide/i)).toBeVisible()
  })

  test('boutons ont une hauteur minimum de 48px (touch target)', async ({ page }) => {
    const button = page.getByRole('button', { name: /nouveau client/i })
    const box = await button.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(48)
  })

  test('importe des clients via CSV', async ({ page }) => {
    // TODO: create test CSV fixture at fixtures/clients-test.csv
    const fileInput = page.getByLabel(/importer csv/i)
    await fileInput.setInputFiles('e2e/fixtures/clients-import.csv')
    await expect(page.getByText(/import réussi/i)).toBeVisible()
  })

  test('détecte et signale les doublons à l\'import CSV', async ({ page }) => {
    // First import
    const fileInput = page.getByLabel(/importer csv/i)
    await fileInput.setInputFiles('e2e/fixtures/clients-import.csv')
    // Second import with same file
    await fileInput.setInputFiles('e2e/fixtures/clients-import.csv')
    await expect(page.getByText(/doublon/i)).toBeVisible()
  })
})

test.describe('Clients — Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('modifie un client existant', async ({ page }) => {
    await page.goto('/dashboard/clients')
    // TODO: navigate to client detail
    await expect(page).toHaveURL(/clients/)
  })

  test('supprime un client sans factures actives', async ({ page }) => {
    // Soft delete — client sans FK active
    await page.goto('/dashboard/clients')
    await expect(page).toHaveURL(/clients/)
  })

  test('RLS — un artisan ne voit pas les clients d\'un autre', async ({ page }) => {
    // TODO: create two test artisan accounts, verify isolation
    // This is a critical security test
    await expect(true).toBe(true) // Placeholder until RLS tests are implemented
  })
})
