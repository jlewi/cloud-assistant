import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // You can change this to any port you prefer
    strictPort: true, // Ensures Vite doesn't try another port if 3000 is taken
  },
})
