/* 
================================================================================
Código: /vite.config.ts
Versão: 1.0.0
Data/Hora: 2025-10-06 17:35
Autor: FL / Execução via AD
Objetivo: Habilitar alias "@/..." no bundler Vite para resolver imports absolutos a partir de /src
Fluxo: Vite -> resolve.alias('@' -> 'src') -> build/dev server
Dependências: vite, @vitejs/plugin-react, node:path
Regras de Projeto:
  - Manter alias '@' apontando para 'src' em toda a base.
  - Overlay de HMR permanece ativo para facilitar debug.
================================================================================
*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    hmr: {
      overlay: true,
    },
  },
})
