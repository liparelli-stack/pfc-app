/** @type {import('tailwindcss').Config} */
/*
-- ===================================================
-- Código: /tailwind.config.js
-- Versão (.v20): 1.2.0
-- Data/Hora: 2025-11-27 11:00
-- Autor: FL / Execução via Dualite Alpha (AD)
-- Objetivo: Aumentar significativamente o contraste do tema claro para evidenciar os efeitos neumórficos.
-- Fluxo: N/A
-- Alterações (1.2.0):
--   • A cor da sombra escura (`dark-shadow`) foi escurecida para `#a9b1c0`.
--   • Aumentada a intensidade e o espalhamento das sombras (`neumorphic-convex` e `neumorphic-concave`) para o tema claro.
-- ===================================================
*/
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'plate': '#e9edf3',
        'plate-dark': '#2d3748',
        'primary': '#1c4c96',
        'light-shadow': '#ffffff',
        'dark-shadow': '#a9b1c0', // Sombra mais escura para maior contraste
        'dark-light-shadow': '#3a455a',
        'dark-dark-shadow': '#202836',
      },
      boxShadow: {
        'neumorphic-convex': '7px 7px 14px #a9b1c0, -7px -7px 14px #ffffff',
        'neumorphic-convex-strong': '9px 9px 18px #a9b1c0, -9px -9px 18px #ffffff',
        'neumorphic-concave': 'inset 7px 7px 14px #a9b1c0, inset -7px -7px 14px #ffffff',
        'neumorphic-convex-dark': '5px 5px 10px #202836, -5px -5px 10px #3a455a',
        'neumorphic-convex-strong-dark': '7px 7px 14px #202836, -7px -7px 14px #3a455a',
        'neumorphic-concave-dark': 'inset 5px 5px 10px #202836, inset -5px -5px 10px #3a455a',
      }
    },
  },
  plugins: [],
}
