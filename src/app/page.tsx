import { redirect } from 'next/navigation'

// Root page: middleware handles auth-based redirection.
// If reached, redirect to dashboard as default.
export default function HomePage() {
  redirect('/dashboard')
}
