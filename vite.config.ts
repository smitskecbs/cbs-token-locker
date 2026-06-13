import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  envPrefix: ['VITE_', 'HELIUS_'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
