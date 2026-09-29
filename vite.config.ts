import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['escena-logo.svg'],
    workbox: { navigateFallbackDenylist: [/^\/listen(?:\/|$)/] },
    manifest: {
      name: 'Escena · Els concerts, clars',
      short_name: 'Escena',
      description: 'Tota la informació del concert, al mateix lloc.',
      theme_color: '#182846',
      background_color: '#f5f7fb',
      display: 'standalone',
      start_url: '/',
      icons: [{ src: '/escena-logo.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }, { src: '/escena-logo.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }],
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
