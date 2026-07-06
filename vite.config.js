import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/ksphere.world/', // This MUST match your repository name!
  plugins: [
    react(),
    tailwindcss(),
  ],
})