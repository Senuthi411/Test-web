import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const FEATURES = ['identity', 'capture', 'review', 'cases', 'analytics']

/** Another feature may only be imported through its public API (`@/features/<name>`). */
const noDeepFeatureImports = {
  group: FEATURES.flatMap((feature) => [`@/features/${feature}/*`, `!@/features/${feature}/fixtures`, `!@/features/${feature}/http`, `!@/features/${feature}/pages`]),
  message: 'Import other features through their public API (@/features/<name>), not their internals.',
}

const restrict = (...patterns) => ['error', { patterns }]

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // ── Architecture boundaries ────────────────────────────────────────────────
  {
    // Shared code is feature-agnostic.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['@/features/*', '@/app/*', '@/fixtures', '@/fixtures/*'], message: 'src/shared must not depend on features, the app layer or fixtures.' },
      ),
    },
  },
  {
    // Fixtures are plain data; they never depend on UI or features.
    files: ['src/fixtures/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['@/features/*', '@/app/*', 'react', 'react-*', '@tanstack/*', 'axios'], message: 'Fixtures are framework-free data.' },
      ),
    },
  },
  {
    // Feature code: only public APIs of other features.
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(noDeepFeatureImports, { group: ['@/app/*'], message: 'Features must not depend on the app layer.' }),
    },
  },
  {
    // Domain layer: pure TypeScript.
    files: ['src/features/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        noDeepFeatureImports,
        { group: ['react', 'react-*', 'react-router', '@tanstack/*', 'axios', '@/fixtures', '@/fixtures/*', '@/app/*', '../infrastructure/*', '../presentation/*', '../application/*'], message: 'The domain layer must stay framework- and infrastructure-free.' },
      ),
    },
  },
  {
    // Application layer: use cases depend on ports, not on adapters or UI.
    files: ['src/features/*/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        noDeepFeatureImports,
        { group: ['react', 'react-*', 'react-router', 'axios', '@/fixtures', '@/fixtures/*', '../infrastructure/*', '../presentation/*'], message: 'Use cases depend on ports only.' },
      ),
    },
  },
  {
    // Presentation layer: no direct HTTP or fixture access — go through ports.
    files: ['src/features/*/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        noDeepFeatureImports,
        { group: ['axios', '@/fixtures', '@/fixtures/*', '@/shared/api/httpClient', '../../infrastructure/*', '../infrastructure/*'], message: 'Presentation code reaches data only through application ports.' },
      ),
    },
  },
])
