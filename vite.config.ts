import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdfjs-dist'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'dexie'],
        },
      },
    },
  },
})
