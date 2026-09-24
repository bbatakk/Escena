import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'Escena · Els concerts, clars',
      short_name: 'Escena',
      description: 'Tota la informació del concert, al mateix lloc.',
      theme_color: '#182846',
      background_color: '#f5f7fb',
      display: 'standalone',
      start_url: '/',
      icons: [{ src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }],
    },
  })],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom/client'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
