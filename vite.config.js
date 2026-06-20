import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE: this config is a reconstruction (the original vite.config.js was
// lost in a dev-environment reset). It covers what the app actually needs
// — React + a PWA service worker — but double-check the manifest fields
// (name/colors/icons) against your real branding before relying on this
// for a production PWA install prompt.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'PoultrySuite Africa',
        short_name: 'PoultrySuite',
        description: 'Tablet-first farm management for African poultry operations — by AgoroX Technologies',
        theme_color: '#0f5540',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
});
