import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 999999,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'bundle.js',
        chunkFileNames: 'bundle.js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
