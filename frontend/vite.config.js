import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // Si usas PWA

export default defineConfig({
  plugins: [
    react(),
    
  ],
  
  base: '/', 
})