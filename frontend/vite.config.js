// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },   // dev: accessible from LAN
  preview: { host: true, port: 4173 }   // vite preview (optional)
})
