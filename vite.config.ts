import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/schedule': {
        target: 'https://batish53.app.n8n.cloud',
        changeOrigin: true,
        rewrite: () => '/webhook/Campus-Guide-Schedule',
      },
    },
  },
})
