import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// import viteCompression from 'vite-plugin-compression'

const GIT_SHA_SHORT = process.env.GIT_SHA_SHORT
  ? `.${process.env.GIT_SHA_SHORT}`
  : ''

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
        entryFileNames: `index${GIT_SHA_SHORT}.js`,
        chunkFileNames: `index${GIT_SHA_SHORT}.js`,
        assetFileNames: `[name]${GIT_SHA_SHORT}.[ext]`,
      },
    },
  },
})
