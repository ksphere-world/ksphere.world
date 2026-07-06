import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // CHANGE THIS to your exact GitHub repository name! 
  // e.g., if your repo is github.com/johndoe/kindness-app, base should be '/kindness-app/'
  base: '/ksphere.world/', 
  plugins: [
    react(),
    tailwindcss(),
  ],
})