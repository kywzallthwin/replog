import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
