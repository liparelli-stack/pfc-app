/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ─── FONTES ───────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      fontWeight: {
        // NÃO usar 600 ou 700 — padrão Linear/Vercel
        light: '300',
        normal: '400',
        medium: '500',
      },

      // ─── CORES ────────────────────────────────────────────────────────────
      colors: {
        // --- Surfaces (Dark) ---
        'dark-bg':  '#0c0d10', // layer 0 — app background
        'dark-s1':  '#13151a', // layer 1 — cards base
        'dark-s2':  '#1a1d24', // layer 2 — hover / active
        'dark-s3':  '#22262f', // layer 3 — selected / inputs
        'dark-s4':  '#2c313c', // layer 4 — elevated modals

        // --- Surfaces (Light) ---
        'light-bg': '#f4f5f7', // layer 0
        'light-s1': '#eef0f4', // layer 1 — cards
        'light-s2': '#f8f9fb', // layer 2 — hover
        'light-s3': '#ffffff', // layer 3 — elevated

        // --- Surfaces (Sépia) ---
        'sepia-bg': '#f5ead8',
        'sepia-s1': '#ede0ca',
        'sepia-s2': '#e5d5b8',
        'sepia-s3': '#fdf6ec',

        // --- Texto (Dark) ---
        'dark-t1': '#f0eeec', // primário
        'dark-t2': '#9096a3', // secundário / muted
        'dark-t3': '#555b68', // terciário / placeholders

        // --- Texto (Light) ---
        'light-t1': '#0f1117',
        'light-t2': '#5a6172',
        'light-t3': '#9096a3',

        // --- Texto (Sépia) ---
        'sepia-t1': '#3b2e1a',
        'sepia-t2': '#7a6347',
        'sepia-t3': '#9a7d5a',

        // --- Accent / Primário ---
        // Azul CRMappy — diferenciado do Tailwind blue-600 (#2563EB)
        accent: {
          DEFAULT:  '#3b68f5', // dark
          light:    '#4f7cff', // dark hover
          dim:      'rgba(59,104,245,0.12)',
          border:   'rgba(59,104,245,0.38)',
          '20':     'rgba(59,104,245,0.20)',
          '15':     'rgba(59,104,245,0.15)',
          // Para modo light
          lbase:    '#1c4c96',
          ldim:     'rgba(28,76,150,0.10)',
          lborder:  'rgba(28,76,150,0.30)',
        },

        // --- Semânticas ---
        success: {
          DEFAULT: '#3ecf8e', // dark
          dim:     'rgba(62,207,142,0.11)',
          border:  'rgba(62,207,142,0.22)',
          light:   '#0f9e62', // light mode
        },
        warning: {
          DEFAULT: '#f59e0b', // dark
          dim:     'rgba(245,158,11,0.11)',
          border:  'rgba(245,158,11,0.22)',
          light:   '#b07408', // light mode
        },
        danger: {
          DEFAULT: '#f06060', // dark
          dim:     'rgba(240,96,96,0.10)',
          border:  'rgba(240,96,96,0.22)',
          light:   '#d94040', // light mode
        },
        ai: {
          DEFAULT: '#a78bfa', // purple — AI Insight
          dim:     'rgba(167,139,250,0.11)',
          border:  'rgba(167,139,250,0.22)',
          light:   '#7c5cbf',
        },

        // --- Borders (Dark) ---
        'dark-blo': 'rgba(255,255,255,0.06)', // sutil
        'dark-bmd': 'rgba(255,255,255,0.11)', // médio
        'dark-bhi': 'rgba(255,255,255,0.17)', // highlight (border-top de cards)

        // --- Borders (Light) ---
        'light-blo': 'rgba(0,0,0,0.07)',
        'light-bmd': 'rgba(0,0,0,0.10)',
        'light-bhi': 'rgba(0,0,0,0.16)',
      },

      // ─── BORDER RADIUS ────────────────────────────────────────────────────
      borderRadius: {
        sm:   '6px',
        DEFAULT: '8px',  // --r
        lg:   '12px',    // --rlg
        xl:   '16px',    // --rxl
        '2xl':'20px',    // badges
        full: '9999px',
      },

      // ─── SOMBRAS ─────────────────────────────────────────────────────────
      boxShadow: {
        // Depth system — Dark
        'sh1': '0 1px 3px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.22)',
        'sh2': '0 2px 8px rgba(0,0,0,0.38), 0 8px 28px rgba(0,0,0,0.28)',
        'sha': '0 0 0 1px rgba(59,104,245,0.38), 0 4px 20px rgba(59,104,245,0.18)',

        // Focus ring
        'focus-accent': '0 0 0 3px rgba(59,104,245,0.15)',
        'focus-danger':  '0 0 0 3px rgba(240,96,96,0.15)',

        // Depth system — Light (sombras mais suaves)
        'sh1-light': '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
        'sh2-light': '0 2px 8px rgba(0,0,0,0.10), 0 8px 20px rgba(0,0,0,0.08)',
        'sha-light': '0 0 0 1px rgba(28,76,150,0.30), 0 4px 16px rgba(28,76,150,0.12)',

        // Button primary glow
        'btn-primary': '0 1px 8px rgba(59,104,245,0.35)',
        'btn-primary-hover': '0 2px 14px rgba(59,104,245,0.45)',

        // Neumorfismo legado — mantido para não quebrar componentes antigos
        'neumorphic-convex':  '6px 6px 12px #a9b1c0, -6px -6px 12px #ffffff',
        'neumorphic-concave': 'inset 6px 6px 12px #a9b1c0, inset -6px -6px 12px #ffffff',
        'dark-neumorphic-convex':  '6px 6px 12px #0a0b0e, -6px -6px 12px #1e2028',
        'dark-neumorphic-concave': 'inset 6px 6px 12px #0a0b0e, inset -6px -6px 12px #1e2028',
      },

      // ─── TRANSIÇÕES ──────────────────────────────────────────────────────
      transitionTimingFunction: {
        // ease padrão do sistema — cubic-bezier Material-like
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
        fast: '150ms',
        slow: '300ms',
      },

      // ─── TIPOGRAFIA (escalas) ─────────────────────────────────────────────
      fontSize: {
        // Escala do design system
        'label':   ['10.5px', { letterSpacing: '0.09em', lineHeight: '1' }],
        'micro':   ['11px',   { lineHeight: '1.4' }],
        'caption': ['11.5px', { lineHeight: '1.5' }],
        'body-sm': ['12px',   { lineHeight: '1.5' }],
        'body':    ['13px',   { lineHeight: '1.6' }],
        'body-md': ['14px',   { lineHeight: '1.75' }],
        'heading': ['17px',   { letterSpacing: '-0.01em', lineHeight: '1.3' }],
        'title':   ['20px',   { letterSpacing: '-0.02em', lineHeight: '1.2' }],
        'display': ['27px',   { letterSpacing: '-0.03em', lineHeight: '1.1' }],
        'hero':    ['30px',   { letterSpacing: '-0.025em', lineHeight: '1.15' }],
      },

      // ─── PLATE (legado Neumorfismo — não remover) ─────────────────────────
      // Mantido para compatibilidade com componentes v0100 ainda não migrados
      backgroundColor: {
        plate:      '#e0e5ec',
        'plate-dark': '#1a1d24',
      },
    },
  },

  plugins: [
    // Plugin utilitário para border-top highlight de cards
    function ({ addUtilities }) {
      addUtilities({
        // Card com border-top mais claro (simula luz vinda de cima)
        '.card-border': {
          'border': '0.5px solid rgba(255,255,255,0.11)',
          'border-top': '0.5px solid rgba(255,255,255,0.17)',
        },
        '.card-border-light': {
          'border': '0.5px solid rgba(0,0,0,0.10)',
          'border-top': '0.5px solid rgba(0,0,0,0.04)',
        },
        // Texto com letter-spacing negativo (valores KPI)
        '.tracking-kpi': {
          'letter-spacing': '-0.03em',
        },
        '.tracking-tight-md': {
          'letter-spacing': '-0.02em',
        },
        '.tracking-tight-sm': {
          'letter-spacing': '-0.01em',
        },
        // Label uppercase padrão do sistema
        '.label-upper': {
          'font-size': '11px',
          'letter-spacing': '0.09em',
          'text-transform': 'uppercase',
          'font-weight': '500',
        },
      })
    },
  ],
}
