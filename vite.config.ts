import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:4175' } },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
    includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
    manifest: {
      name: 'San Francisco Vecino',
      short_name: 'SF Vecino',
      description: 'Servicios municipales de San Francisco',
      theme_color: '#315c4c',
      background_color: '#f7f8f4',
      display: 'standalone',
      lang: 'es',
      start_url: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  })],
})
