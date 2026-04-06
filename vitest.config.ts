import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Only collect unit/component tests from src — e2e tests run via Playwright
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'istanbul',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/*.stories.*',
        // App Router pages/layouts/routes — covered by e2e tests
        'src/app/**',
        // Middleware — covered by e2e tests
        'src/middleware.ts',
        // Supabase infrastructure — mocked in unit tests
        'src/lib/supabase/**',
        // Feature UI components — covered by e2e tests
        'src/components/features/dashboard/**',
        'src/components/features/clients/**',
        'src/components/features/devis/**',
        'src/components/features/factures/**',
        // shadcn/ui primitives — tested indirectly via component tests
        'src/components/ui/card.tsx',
        'src/components/ui/separator.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
