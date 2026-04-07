import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupPage from '../page'

// Hoisted mocks — must be defined before vi.mock() factories execute
const mockPush = vi.hoisted(() => vi.fn())
const mockSignUp = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
    },
  },
}))

// Mock localStorage
const localStorageSetItem = vi.fn()
Object.defineProperty(window, 'localStorage', {
  value: {
    setItem: localStorageSetItem,
    getItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
})

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial render', () => {
    it('renders email and password fields', () => {
      render(<SignupPage />)
      expect(screen.getByLabelText(/Adresse email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Mot de passe/i)).toBeInTheDocument()
    })

    it('renders signup button', () => {
      render(<SignupPage />)
      expect(screen.getByRole('button', { name: /Creer mon compte/i })).toBeInTheDocument()
    })

    it('renders login link', () => {
      render(<SignupPage />)
      expect(screen.getByRole('link', { name: /Se connecter/i })).toBeInTheDocument()
    })
  })

  describe('password validation', () => {
    it('shows error when password is less than 6 characters', async () => {
      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), '12345')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      await waitFor(() => {
        expect(screen.getByText(/au moins 6 caracteres/i)).toBeInTheDocument()
      })
    })

    it('does not call signUp when password is too short', async () => {
      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), '123')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  describe('successful signup', () => {
    it('redirects to /verify-email on success', async () => {
      mockSignUp.mockResolvedValue({ error: null })

      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/verify-email')
      })
    })

    it('saves email to localStorage on successful signup', async () => {
      mockSignUp.mockResolvedValue({ error: null })

      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      await waitFor(() => {
        expect(localStorageSetItem).toHaveBeenCalledWith('hellobat_signup_email', 'artisan@test.fr')
      })
    })
  })

  describe('signup errors', () => {
    it('shows friendly message when email already registered', async () => {
      mockSignUp.mockResolvedValue({
        error: { message: 'User already registered' },
      })

      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'existing@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      await waitFor(() => {
        expect(screen.getByText(/Un compte existe deja/i)).toBeInTheDocument()
      })
    })

    it('shows raw error for other signup errors', async () => {
      mockSignUp.mockResolvedValue({
        error: { message: 'Signup disabled' },
      })

      render(<SignupPage />)

      await userEvent.type(screen.getByLabelText(/Adresse email/i), 'artisan@test.fr')
      await userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: /Creer mon compte/i }))

      await waitFor(() => {
        expect(screen.getByText('Signup disabled')).toBeInTheDocument()
      })
    })
  })
})
