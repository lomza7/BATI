import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../login-form'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const mockSignInWithPassword = vi.fn()
const mockSignInWithOtp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOtp: mockSignInWithOtp,
    },
  }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial render', () => {
    it('renders email and password fields', () => {
      render(<LoginForm />)
      expect(screen.getByLabelText('Adresse email')).toBeInTheDocument()
      expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    })

    it('renders submit and magic link buttons', () => {
      render(<LoginForm />)
      expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Connexion par lien magique' })
      ).toBeInTheDocument()
    })

    it('renders no error message by default', () => {
      render(<LoginForm />)
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
    })
  })

  describe('email/password login', () => {
    it('submits with valid credentials and redirects to dashboard', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')
      await user.click(screen.getByRole('button', { name: 'Se connecter' }))

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'jean@artisan.fr',
          password: 'motdepasse123',
        })
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('shows error message on invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'mauvaismdp')
      await user.click(screen.getByRole('button', { name: 'Se connecter' }))

      await waitFor(() => {
        expect(screen.getByText('Email ou mot de passe incorrect.')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('disables buttons during submit (loading state)', async () => {
      mockSignInWithPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
      )
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')

      const submitBtn = screen.getByRole('button', { name: 'Se connecter' })
      await user.click(submitBtn)

      expect(screen.getByRole('button', { name: 'Connexion...' })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Connexion par lien magique' })
      ).toBeDisabled()
    })
  })

  describe('magic link', () => {
    it('shows success message after magic link sent', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.click(screen.getByRole('button', { name: 'Connexion par lien magique' }))

      await waitFor(() => {
        expect(
          screen.getByText(/Un lien de connexion a été envoyé à/)
        ).toBeInTheDocument()
        expect(screen.getByText('jean@artisan.fr')).toBeInTheDocument()
      })
    })

    it('shows error if email is empty when clicking magic link', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.click(screen.getByRole('button', { name: 'Connexion par lien magique' }))

      expect(
        screen.getByText('Veuillez entrer votre adresse email.')
      ).toBeInTheDocument()
      expect(mockSignInWithOtp).not.toHaveBeenCalled()
    })

    it('shows error when OTP request fails', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.click(screen.getByRole('button', { name: 'Connexion par lien magique' }))

      await waitFor(() => {
        expect(
          screen.getByText("Erreur lors de l'envoi du lien magique.")
        ).toBeInTheDocument()
      })
    })
  })
})
