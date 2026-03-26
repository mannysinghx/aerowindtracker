import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        crosswindCalculator:    resolve(__dirname, 'features/crosswind-calculator/index.html'),
        aviationWeatherMap:     resolve(__dirname, 'features/live-aviation-weather-map/index.html'),
        aiHazardIntelligence:   resolve(__dirname, 'features/ai-hazard-intelligence/index.html'),
        notamDecoder:           resolve(__dirname, 'features/notam-decoder/index.html'),
      },
    },
  },
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
