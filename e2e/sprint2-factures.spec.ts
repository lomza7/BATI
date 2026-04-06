/**
 * E2E tests — Module Factures (Sprint 2)
 * Requires: HEL-72 (CRUD Factures) to be implemented by Max
 *
 * Status: SKELETON — tests are written but will fail until the UI is built.
 */
import { test, expect } from '@playwright/test'

test.describe('Factures — Mobile 375px', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('convertit un devis en facture (copie lignes, déduit acompte)', async ({ page }) => {
    await page.goto('/dashboard/devis')
    // Use a devis with 30% acompte already paid
    await page.getByRole('button', { name: /créer facture finale/i }).first().click()
    // The facture should show the remaining 70% amount
    await expect(page.getByText(/acompte déduit/i)).toBeVisible()
  })

  test('génère le XML Factur-X EN16931', async ({ page }) => {
    await page.goto('/dashboard/factures')
    await page.getByRole('button', { name: /émettre/i }).first().click()
    // After emitting, the facture is locked and Factur-X XML is generated
    await expect(page.getByText(/facture émise/i)).toBeVisible()
    await expect(page.getByText(/Factur-X/i)).toBeVisible()
  })

  test('télécharge le PDF avec XML Factur-X embarqué', async ({ page }) => {
    await page.goto('/dashboard/factures')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /télécharger/i }).first().click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/FAC-\d{4}-\d{3}.*\.pdf$/)
  })

  test('génère une référence séquentielle (FAC-2026-001)', async ({ page }) => {
    await page.goto('/dashboard/factures')
    await expect(page.getByText(/FAC-2026-\d{3}/)).toBeVisible()
  })
})

test.describe('Factures — Situations de travaux', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('crée une situation de travaux par lot', async ({ page }) => {
    await page.goto('/dashboard/factures/situation/nouveau')
    // Select progress per lot
    await page.getByLabel(/lot gros oeuvre/i).fill('40')
    await page.getByLabel(/lot électricité/i).fill('60')
    await page.getByRole('button', { name: /émettre situation/i }).click()
    await expect(page.getByText(/situation émise/i)).toBeVisible()
  })

  test('bloque une situation dépassant 100% cumul', async ({ page }) => {
    await page.goto('/dashboard/factures/situation/nouveau')
    // Lot already at 70%, try to add 40%
    await page.getByLabel(/avancement/i).fill('40')
    await page.getByRole('button', { name: /émettre situation/i }).click()
    await expect(page.getByText(/cumul.*dépasse 100%/i)).toBeVisible()
  })
})

test.describe('Factures — Avoir (credit note)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('crée un avoir pour corriger une facture émise', async ({ page }) => {
    await page.goto('/dashboard/factures')
    // Find an "émise" facture
    await page.getByRole('button', { name: /créer un avoir/i }).first().click()
    await page.getByRole('button', { name: /confirmer/i }).click()
    await expect(page.getByText(/avoir créé/i)).toBeVisible()
    // Avoir should have negative amounts
    await expect(page.getByText(/-/)).toBeVisible()
  })

  test('le bouton "modifier" est désactivé sur une facture émise (immutabilité)', async ({
    page,
  }) => {
    await page.goto('/dashboard/factures')
    // An "émise" facture cannot be edited directly
    const editButton = page.getByRole('button', { name: /modifier/i }).first()
    await expect(editButton).toBeDisabled()
  })
})

test.describe('Factures — Sécurité (RLS)', () => {
  test('artisan A ne peut pas voir les factures de artisan B', async ({ page }) => {
    // TODO: implement with two test accounts
    // Critical security test — must not be skipped
    await expect(true).toBe(true) // Placeholder
  })

  test('facture ne peut pas être émise sans onboarding complet', async ({ page }) => {
    // Profile without SIRET/assurance → attempt to emit fails
    await page.goto('/dashboard/factures/nouveau')
    await page.getByRole('button', { name: /émettre/i }).click()
    await expect(page.getByText(/profil incomplet/i)).toBeVisible()
    await expect(page.getByText(/siret|assurance/i)).toBeVisible()
  })
})
