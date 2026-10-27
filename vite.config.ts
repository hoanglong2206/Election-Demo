import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  root: '.',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/app'),
      '@common': path.resolve(import.meta.dirname, './src/common'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_filename, deps) => {
        // Exclude heavy document parsers (pdfjs, unpdf, mammoth) from initial modulepreload
        return deps.filter(
          (dep) =>
            !dep.includes('pdfjs') &&
            !dep.includes('dist-') &&
            !dep.includes('unpdf') &&
            !dep.includes('mammoth') &&
            !dep.includes('documentParser') &&
            !dep.includes('document-parser')
        )
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('unpdf') || id.includes('pdfjs')) {
            return 'pdfjs-vendor'
          }
          if (id.includes('mammoth')) {
            return 'mammoth-vendor'
          }
          if (id.includes('documentParser')) {
            return 'document-parser'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
