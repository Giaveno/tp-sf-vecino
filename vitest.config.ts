import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['src/**/*.test.ts'], forbidOnly: Boolean(process.env.CI) } })
