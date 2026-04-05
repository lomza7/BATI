import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from '../signup-form'

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

const mockSignUp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial render', () => {
    it('renders full name, email, and password fields', () => {
      render(<SignupForm />)
      expect(screen.getByLabelText('Nom complet')).toBeInTheDocument()
      expect(screen.getByLabelText('Adresse email')).toBeInTheDocument()
      expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<SignupForm />)
      expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument()
    })

    it('renders no error message by default', () => {
      render(<SignupForm />)
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('submits with valid data and redirects to dashboard', async () => {
      mockSignUp.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'jean@artisan.fr',
          password: 'motdepasse123',
          options: {
            data: { full_name: 'Jean Dupont' },
            emailRedirectTo: expect.stringContaining('/auth/callback'),
          },
        })
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('shows confirmation message after successful signup', async () => {
      mockSignUp.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      await waitFor(() => {
        expect(
          screen.getByText(/Un email de confirmation a été envoyé à/)
        ).toBeInTheDocument()
        expect(screen.getByText('jean@artisan.fr')).toBeInTheDocument()
      })
    })

    it('disables button during submit (loading state)', async () => {
      mockSignUp.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
      )
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      expect(screen.getByRole('button', { name: 'Création...' })).toBeDisabled()
    })
  })

  describe('validation', () => {
    it('shows error when password is shorter than 8 characters', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'court')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      await waitFor(() => {
        expect(
          screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')
        ).toBeInTheDocument()
      })
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('accepts password of exactly 8 characters', async () => {
      mockSignUp.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), '12345678')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled()
      })
    })

    it('shows Supabase error message on signup failure', async () => {
      mockSignUp.mockResolvedValue({
        error: { message: 'User already registered' },
      })
      const user = userEvent.setup()
      render(<SignupForm />)

      await user.type(screen.getByLabelText('Nom complet'), 'Jean Dupont')
      await user.type(screen.getByLabelText('Adresse email'), 'jean@artisan.fr')
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123')
      await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

      await waitFor(() => {
        expect(screen.getByText('User already registered')).toBeInTheDocument()
      })
    })
  })
})
