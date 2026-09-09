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
    // recharts (charts) y jsPDF (pdf) solo los usan páginas internas cargadas con
    // React.lazy — Vite igual los agrega como <link modulepreload> en el único
    // index.html (SPA con HashRouter, una sola entrada para todas las rutas), así que
    // sin este filtro se descargaban de una vez en /login antes de autenticarse, pese
    // al code-splitting por ruta. `firebase` no se filtra: AuthContext lo importa de
    // forma estática (no lazy) porque el estado de sesión se necesita de inmediato.
    modulePreload: {
      resolveDependencies: (_filename, deps, { hostType }) =>
        hostType === 'html' ? deps.filter((dep) => !dep.includes('/charts-') && !dep.includes('/pdf-')) : deps,
    },
    // El chunk de charts (recharts + sus dependencias D3) ronda ~526 kB porque no se
    // usa ninguna otra librería adicional a propósito, no por imports sin tree-shaking
    // (los 9 componentes en src/charts/ ya importan solo los named exports que usan).
    // Con el filtro de modulePreload de arriba, este chunk nunca bloquea /login: se
    // resuelve por separado cuando de verdad se navega a una página con gráficos.
    chunkSizeWarningLimit: 600,
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
