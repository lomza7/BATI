import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Unit/component tests only — e2e tests run via Playwright
    include: [
      'lib/**/*.{test,spec}.{ts,tsx}',
      'components/**/__tests__/*.{test,spec}.{ts,tsx}',
      'app/**/__tests__/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'istanbul',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      exclude: [
        'lib/**/*.d.ts',
        'test/**',
        '**/*.stories.*',
        // App Router pages/layouts/routes — covered by e2e tests
        'app/**',
        // Middleware — covered by e2e tests
        'middleware.ts',
        // Supabase/Clerk infrastructure — mocked in unit tests
        'lib/supabase.ts',
        'lib/supabase-admin.ts',
        'lib/auth-context.tsx',
        // shadcn/ui primitives — tested indirectly
        'components/ui/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
