/**
 * E2E tests — Module Devis (Sprint 2)
 * Requires: HEL-71 (CRUD Devis) to be implemented by Max
 *
 * Status: SKELETON — tests are written but will fail until the UI is built.
 */
import { test, expect } from '@playwright/test'

test.describe('Devis — Mobile 375px (iPhone SE)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/devis')
  })

  test('crée un devis complet avec lots et postes', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau devis/i }).click()

    // Titre + client
    await page.getByLabel(/titre/i).fill('Rénovation salle de bain')

    // Ajouter un lot
    await page.getByRole('button', { name: /ajouter un lot/i }).click()
    await page.getByLabel(/nom du lot/i).fill('Plomberie')

    // Ajouter un poste
    await page.getByRole('button', { name: /ajouter un poste/i }).click()
    await page.getByLabel(/description/i).fill('Remplacement robinet')
    await page.getByLabel(/quantité/i).fill('1')
    await page.getByLabel(/prix unitaire/i).fill('150')
    await page.getByLabel(/TVA/i).selectOption('10')

    // Verify totals auto-calculated
    await expect(page.getByText(/150,00 €/)).toBeVisible()
    await expect(page.getByText(/165,00 €/)).toBeVisible() // TTC

    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page).toHaveURL(/devis\//)
  })

  test('calcule TVA ventilée (10% + 20%) correctement', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau devis/i }).click()

    // Lot 1: main d'oeuvre @ 10%
    await page.getByRole('button', { name: /ajouter un lot/i }).click()
    await page.getByRole('button', { name: /ajouter un poste/i }).first().click()
    await page.getByLabel(/prix unitaire/i).first().fill('800')
    await page.getByLabel(/TVA/i).first().selectOption('10')

    // Lot 2: matériaux @ 20%
    await page.getByRole('button', { name: /ajouter un lot/i }).click()
    await page.getByRole('button', { name: /ajouter un poste/i }).last().click()
    await page.getByLabel(/prix unitaire/i).last().fill('200')
    await page.getByLabel(/TVA/i).last().selectOption('20')

    // Totals: HT=1000, TVA=120 (80+40), TTC=1120
    await expect(page.getByTestId('total-ht')).toHaveText(/1 000,00 €/)
    await expect(page.getByTestId('total-tva')).toHaveText(/120,00 €/)
    await expect(page.getByTestId('total-ttc')).toHaveText(/1 120,00 €/)
  })

  test('applique une remise globale', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau devis/i }).click()
    // Add a ligne at 1000 HT 20%
    await page.getByRole('button', { name: /ajouter un lot/i }).click()
    await page.getByRole('button', { name: /ajouter un poste/i }).click()
    await page.getByLabel(/prix unitaire/i).fill('1000')
    await page.getByLabel(/TVA/i).selectOption('20')

    // Apply 10% discount
    await page.getByLabel(/remise/i).fill('10')

    // HT: 900, TVA: 180, TTC: 1080
    await expect(page.getByTestId('total-ht')).toHaveText(/900,00 €/)
    await expect(page.getByTestId('total-ttc')).toHaveText(/1 080,00 €/)
  })

  test('génère une référence séquentielle (DEV-2026-001)', async ({ page }) => {
    await page.getByRole('button', { name: /nouveau devis/i }).click()
    await page.getByLabel(/titre/i).fill('Test séquence')
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await expect(page.getByText(/DEV-2026-\d{3}/)).toBeVisible()
  })

  test('boutons navigation lot utilisent flèches (pas drag-drop) sur mobile', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /nouveau devis/i }).click()
    await page.getByRole('button', { name: /ajouter un lot/i }).click()
    // Arrows up/down should be visible instead of drag handles
    await expect(page.getByRole('button', { name: /monter/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /descendre/i })).toBeVisible()
  })

  test('génère et télécharge le PDF du devis', async ({ page }) => {
    await page.goto('/dashboard/devis') // Go to an existing devis
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /télécharger PDF/i }).first().click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})

test.describe('Devis — auto-entrepreneur (TVA 0%)', () => {
  test('TVA forcée à 0% pour auto-entrepreneur', async ({ page }) => {
    // TODO: set up auto-entrepreneur profile
    await page.goto('/dashboard/devis/nouveau')
    // TVA selector should be disabled or show 0%
    await expect(page.getByTestId('total-tva')).toHaveText(/0,00 €/)
    await expect(page.getByText(/Art. 293B/i)).toBeVisible()
  })
})

test.describe('Devis — Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('convertit un devis accepté en facture', async ({ page }) => {
    await page.goto('/dashboard/devis')
    // Find an "accepté" devis
    await page.getByRole('button', { name: /convertir en facture/i }).first().click()
    await expect(page).toHaveURL(/factures\//)
  })

  test('envoie le devis par email au client', async ({ page }) => {
    await page.goto('/dashboard/devis')
    await page.getByRole('button', { name: /envoyer/i }).first().click()
    await expect(page.getByText(/devis envoyé/i)).toBeVisible()
  })
})
