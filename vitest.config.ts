import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/client/**/*.{ts,tsx}'],
      provider: 'v8',
    },
  },
})
