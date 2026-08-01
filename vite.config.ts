import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from a subpath matching the actual GitHub
// repository name (currently "Pragbingo-", not the "OurEvent" display name
// used in the UI/README - the two are independent). Every asset URL needs
// that prefix there, or every request 404s and the deployed site is just a
// blank page. If the repo ever gets renamed, this MUST be updated to match
// in the same commit - it silently breaks otherwise, it doesn't error.
// The Capacitor native shell instead loads dist-capacitor/index.html
// straight from the app bundle's root, so that build
// (`npm run build:capacitor`) must NOT have any prefix.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? '/' : '/Pragbingo-/',
  build: {
    outDir: mode === 'capacitor' ? 'dist-capacitor' : 'dist',
  },
  plugins: [react()],
}))
