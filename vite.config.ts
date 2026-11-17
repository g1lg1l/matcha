import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base: the same build runs on GitHub Pages (/matcha/) and inside the Capacitor apps.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
