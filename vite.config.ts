import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  // Publicado en GitHub Pages como sitio de proyecto: sirve desde
  // https://<usuario>.github.io/seam-middleware/, no desde la raíz del dominio.
  // `command` NO sirve para distinguir esto: es 'serve' tanto en `vite dev` como en
  // `vite preview` (solo es 'build' durante `vite build`) — con eso, el preview del
  // build de producción quedaría sirviendo con base "/" mientras el HTML generado
  // pide todo bajo "/seam-middleware/", y cada asset caería al fallback de SPA
  // (index.html) en vez de al JS real. `mode` sí es 'production' en build Y preview.
  base: mode === 'production' ? '/seam-middleware/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
}))
