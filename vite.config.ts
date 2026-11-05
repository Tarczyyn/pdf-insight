import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serwuje aplikację pod /<repo>/, więc wszystkie zasoby muszą mieć ten prefiks.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
})
