import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((env) => mergeConfig(
  viteConfig({ ...env, command: 'serve', isPreview: false }),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
      env: { VITE_DATA_SOURCE: 'fixtures' },
      restoreMocks: true,
    },
  }),
))
