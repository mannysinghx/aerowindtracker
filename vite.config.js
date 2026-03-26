import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy aviationweather.gov METAR via /wx to avoid CORS in local dev.
      // The Express server handles this server-side in production.
      '/wx': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wx/, ''),
      },
      '/api': 'http://localhost:3001'
    }
  }
})
