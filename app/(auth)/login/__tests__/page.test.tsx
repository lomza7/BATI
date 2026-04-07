import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../page'

// Hoisted mocks — must be defined before vi.mock() factories execute
const mockPush = vi.hoisted(() => vi.fn())
const mockReplace = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())
const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignInWithOtp = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOtp: mockSignInWithOtp,
      getSession: mockGetSession,
    },
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial render', () => {
    it('renders email and password fields', () => {
      render(<LoginPage />)
      expect(screen.getByLabelText('Adresse email')).toBeInTheDocument()
      expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    })

    it('renders login and magic link buttons', () => {
      render(<LoginPage />)
      expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /lien de connexion/i })).toBeInTheDocument()
    })

    it('renders signup link', () => {
      render(<LoginPage />)
      expect(screen.getByRole('link', { name: /Créer un compte/i })).toBeInTheDocument()
    })
  })

  describe('successful login', () => {
    it('redirects to /dashboard on success', async () => {
      mockSignInWithPassword.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })

      render(<LoginPage />)

      await userEvent.type(screen.getByLabelText('Adresse email'), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText('Mot de passe'), 'password123')
      await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('login errors', () => {
    it('shows error message on invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      })

      render(<LoginPage />)

      await userEvent.type(screen.getByLabelText('Adresse email'), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrongpass')
      await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

      await waitFor(() => {
        expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument()
      })
    })

    it('shows raw error message for other errors', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Email not confirmed' },
      })

      render(<LoginPage />)

      await userEvent.type(screen.getByLabelText('Adresse email'), 'unverified@test.fr')
      await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass123')
      await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

      await waitFor(() => {
        expect(screen.getByText('Email not confirmed')).toBeInTheDocument()
      })
    })
  })

  describe('magic link', () => {
    it('is disabled when email is empty', () => {
      render(<LoginPage />)
      expect(screen.getByRole('button', { name: /lien de connexion/i })).toBeDisabled()
    })

    it('sends magic link when email is filled', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null })

      render(<LoginPage />)

      await userEvent.type(screen.getByLabelText('Adresse email'), 'artisan@test.fr')
      await userEvent.click(screen.getByRole('button', { name: /lien de connexion/i }))

      await waitFor(() => {
        expect(mockSignInWithOtp).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'artisan@test.fr' })
        )
      })
    })

    it('shows confirmation message after magic link sent', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null })

      render(<LoginPage />)

      await userEvent.type(screen.getByLabelText('Adresse email'), 'artisan@test.fr')
      await userEvent.click(screen.getByRole('button', { name: /lien de connexion/i }))

      await waitFor(() => {
        expect(screen.getByText(/Lien envoye/i)).toBeInTheDocument()
      })
    })
  })

  describe('password visibility toggle', () => {
    it('password field starts as type=password', () => {
      render(<LoginPage />)
      const passwordInput = screen.getByLabelText('Mot de passe')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })
})
