import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'e2e-run-marker',
      transformIndexHtml(html) {
        const runId = process.env.E2E_RUN_ID
        return runId ? html.replace('<head>', `<head><meta data-e2e-run-id="${runId}">`) : html
      },
    },
  ],
  server: {
    host: true,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 1,
    setupFiles: './src/test/setup.ts',
  },
})
