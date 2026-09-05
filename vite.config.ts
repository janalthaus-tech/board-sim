import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so Capacitor WebView can load assets from the file system
  base: './',
  plugins: [react()],
})
