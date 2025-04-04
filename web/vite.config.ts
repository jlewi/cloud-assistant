import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // viteCompression({
    //   algorithm: 'gzip',
    //   ext: '.gz',
    //   deleteOriginFile: false,
    // }),
  ],
  build: {
    chunkSizeWarningLimit: 999999,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'index.js',
        chunkFileNames: 'index.js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
