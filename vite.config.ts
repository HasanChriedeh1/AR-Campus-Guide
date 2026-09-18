import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/schedule': {
        target: 'https://hasanchriedeh.app.n8n.cloud',
        changeOrigin: true,
        rewrite: () => '/webhook/50b9be8b-c068-437d-82d9-ba5718007736',
      },
      '/api/chat': {
        target: 'https://hasanchriedeh.app.n8n.cloud',
        changeOrigin: true,
        rewrite: () => '/webhook/chatbot',
      },
    },
  },
})
