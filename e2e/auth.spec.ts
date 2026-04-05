import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Adresse email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
}

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders branding and form fields', async ({ page }) => {
    await expect(page.getByText('Hellobat').first()).toBeVisible()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
  })

  test('renders primary and magic-link buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Connexion par lien magique' })).toBeVisible()
  })

  test('has link to signup page', async ({ page }) => {
    await expect(page.getByRole('link', { name: "S'inscrire" })).toBeVisible()
  })
})

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('renders branding and all form fields', async ({ page }) => {
    await expect(page.getByText('Créer un compte').first()).toBeVisible()
    await expect(page.getByLabel('Nom complet')).toBeVisible()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Créer mon compte' })).toBeVisible()
  })

  test('has link to login page', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation between auth pages
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('login → signup link navigates to /signup', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: "S'inscrire" }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('signup → login link navigates to /login', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('link', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL('/login')
  })
})

// ---------------------------------------------------------------------------
// Client-side validation (no Supabase required)
// ---------------------------------------------------------------------------

test.describe('Login — client-side validation', () => {
  test('magic link button without email shows inline error', async ({ page }) => {
    await page.goto('/login')
    // Email field is empty — do not fill it
    await page.getByRole('button', { name: 'Connexion par lien magique' }).click()
    await expect(page.getByText('Veuillez entrer votre adresse email.')).toBeVisible()
  })
})

test.describe('Signup — client-side validation', () => {
  test('password shorter than 8 chars shows inline error', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Nom complet').fill('Jean Dupont')
    await page.getByLabel('Adresse email').fill('jean@artisan.fr')
    // Fill a valid-length password first so HTML minLength does not block,
    // then overwrite with a short one via JS to hit the component-level check.
    await page.getByLabel('Mot de passe').fill('motdepasse')
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#password')
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set
        nativeInputValueSetter?.call(input, 'court')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(
      page.getByText('Le mot de passe doit contenir au moins 8 caractères.')
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Middleware / route protection
// ---------------------------------------------------------------------------

test.describe('Protected routes', () => {
  test('unauthenticated user accessing /dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user accessing any protected sub-route is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard/devis')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// Supabase integration — invalid credentials
// ---------------------------------------------------------------------------

test.describe('Login — Supabase errors', () => {
  test('wrong credentials show error message', async ({ page }) => {
    await page.goto('/login')
    await fillLoginForm(page, 'nobody@hellobat.app', 'wrongpassword123')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible()
  })
})
