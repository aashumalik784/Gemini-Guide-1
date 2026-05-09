import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname, 'src'),
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@lib': path.resolve(import.meta.dirname, '../../lib'),
    },
  },
  server: {
    port: 3000
  }
})
