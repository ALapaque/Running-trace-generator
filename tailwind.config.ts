import type { Config } from 'tailwindcss'

/**
 * Thème dark neon.
 *
 * Note de naming : les noms d'échelles (cream / ink / olive / sage / terracotta)
 * sont conservés du thème Komoot pour limiter la churn, mais leurs valeurs
 * ont été remappées en sombre/néon :
 *  - cream-*       : surfaces sombres (page, sheet, cards, borders)
 *  - ink-*         : texte clair sur fond sombre
 *  - olive-*       : accent primaire — cyan néon
 *  - sage-*        : accent élévation — vert lime néon
 *  - terracotta-*  : accent erreur/highlight — magenta néon
 *  - neon-*        : nouveaux tokens explicites (glow, accent secondaire)
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
        // Fonds sombres (page → cards → borders)
        cream: {
          50: '#0B0E14', // page background
          100: '#161A23', // sheet, cards, FABs
          200: '#252B38', // borders subtils
          300: '#3A4252', // hover borders, dividers forts
          400: '#525B73', // texte ultra-secondaire
        },
        // Texte clair (du plus contrasté au plus muted)
        ink: {
          900: '#F1F5F9',
          700: '#CBD5E1',
          500: '#94A3B8',
          400: '#6B7280',
          300: '#4B5563',
          200: '#3F4757',
          100: '#2A3142',
        },
        // Cyan néon (accent primaire — CTAs, sélections, polyline route)
        olive: {
          50: '#E6FDFF',
          100: '#CCFAFF',
          200: '#7FF3FF',
          400: '#33EDFF',
          500: '#00E5FF',
          700: '#00B8CC',
          800: '#0096A6',
          900: '#00E5FF', // alias pour `bg-olive-900` (CTAs)
        },
        // Vert lime néon (élévation + accents éco)
        sage: {
          200: '#3F6B23', // remplit profil altimétrique (dark lime)
          400: '#7CD63E',
          600: '#A8FF00',
        },
        // Magenta néon (alerts / accent secondaire)
        terracotta: {
          400: '#FF1FBA',
          500: '#FF2EC4',
          600: '#FF66D6',
        },
        // Couleurs polyline par type de chemin (synchro PATH_COLORS dans config.ts)
        terrain: {
          route: '#00E5FF',
          chemin: '#FF9F1C',
          single: '#A8FF00',
          mixte: '#B86DFF',
          unknown: '#6B7280',
        },
        // Tokens explicites
        neon: {
          cyan: '#00E5FF',
          magenta: '#FF2EC4',
          lime: '#A8FF00',
          amber: '#FF9F1C',
          purple: '#B86DFF',
        },
      },
      borderRadius: {
        sheet: '24px',
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        // Glow néon pour CTAs et éléments primaires
        'glow-cyan': '0 0 24px -4px rgba(0, 229, 255, 0.55), 0 0 1px rgba(0, 229, 255, 0.9)',
        'glow-magenta': '0 0 24px -4px rgba(255, 46, 196, 0.55), 0 0 1px rgba(255, 46, 196, 0.9)',
        'glow-lime': '0 0 20px -4px rgba(168, 255, 0, 0.45)',
        // Shadow standard pour éléments neutres (sombres → besoin d'élévation visible)
        sheet: '0 -20px 60px -20px rgba(0, 0, 0, 0.6)',
        float: '0 4px 16px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 229, 255, 0.08)',
        card: '0 2px 12px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
      },
      spacing: {
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
        stat: ['28px', { lineHeight: '1.1', fontWeight: '700' }],
        'stat-sm': ['22px', { lineHeight: '1.1', fontWeight: '700' }],
        unit: ['12px', { lineHeight: '1', fontWeight: '500' }],
        label: ['11px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.06em' }],
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-soft': 'cubic-bezier(0.55, 0, 0.55, 0.2)',
      },
    },
  },
  plugins: [],
}
