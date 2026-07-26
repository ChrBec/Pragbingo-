import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from a /Pragbingo-/ subpath, so every asset
// URL needs that prefix there. The Capacitor native shell instead loads
// dist-capacitor/index.html straight from the app bundle's root, so that
// build (`npm run build:capacitor`) must NOT have the prefix - otherwise
// every asset request 404s inside the native WebView.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? '/' : '/Pragbingo-/',
  build: {
    outDir: mode === 'capacitor' ? 'dist-capacitor' : 'dist',
  },
  plugins: [react()],
}))
