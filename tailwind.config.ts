import type { Config } from 'tailwindcss'

/**
 * Palette inspirée Komoot : crèmes chauds, vert olive profond, accent terracotta.
 * Tokens 4/8/16/24/32, rayons généreux, ombres douces.
 */
export default <Config>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './composables/**/*.ts',
    './utils/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        // Crème / fond Komoot
        cream: {
          50: '#FAF7F0',
          100: '#F5EFE3',
          200: '#EBE3D2',
          300: '#DCD0B5',
          400: '#C5B594',
        },
        // Vert olive Komoot (Enregistrer, accents primaires)
        olive: {
          50: '#F2F4EC',
          100: '#E1E6CF',
          200: '#C3CC9F',
          400: '#8BA060',
          500: '#7A8F4F',
          700: '#5B6E3F',
          800: '#42532B',
          900: '#3D4A2A',
        },
        // Vert sauge (élévation)
        sage: {
          200: '#D5E1B8',
          400: '#A8C28C',
          600: '#7FA866',
        },
        // Accent chaud (météo, sélections secondaires)
        terracotta: {
          400: '#E29A7C',
          500: '#D97D5C',
          600: '#B8593A',
        },
        // Couleurs par type de chemin (synchronisées avec PATH_COLORS dans config.ts)
        terrain: {
          route: '#1F6FEB',
          chemin: '#A87B4E',
          single: '#5B7A3F',
          mixte: '#8B8F92',
          unknown: '#A6ABAE',
        },
        // Niveaux de gris neutres chauds
        ink: {
          900: '#1A1A1A',
          700: '#3F3F3F',
          500: '#6B6B6B',
          400: '#8A8A8A',
          300: '#B5B5B5',
          200: '#D6D2C8',
          100: '#EDE9DF',
        },
      },
      borderRadius: {
        sheet: '24px',
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        sheet: '0 -12px 32px -8px rgba(26, 26, 26, 0.18)',
        float: '0 4px 12px -2px rgba(26, 26, 26, 0.18), 0 2px 4px -1px rgba(26, 26, 26, 0.08)',
        card: '0 2px 8px -2px rgba(26, 26, 26, 0.08)',
      },
      spacing: {
        // Tokens 4dp Komoot (en plus de la scale par défaut)
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Hiérarchie type Komoot : grands chiffres pour les stats
        stat: ['28px', { lineHeight: '1.1', fontWeight: '700' }],
        'stat-sm': ['22px', { lineHeight: '1.1', fontWeight: '700' }],
        unit: ['12px', { lineHeight: '1', fontWeight: '500' }],
        label: ['11px', { lineHeight: '1.2', fontWeight: '500', letterSpacing: '0.02em' }],
      },
      transitionTimingFunction: {
        // Courbes Komoot-like
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-soft': 'cubic-bezier(0.55, 0, 0.55, 0.2)',
      },
    },
  },
  plugins: [],
}
