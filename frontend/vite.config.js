import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: "../",  // load .env from project root
  base: "/",
  server: {
    proxy: {
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "",
  },
})
