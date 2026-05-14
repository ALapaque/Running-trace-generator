import type { Config } from 'tailwindcss'

/**
 * Thème « Outdoor naturel ».
 *
 * Naming des échelles conservé (cream / ink / olive / sage / terracotta) pour
 * limiter la churn, valeurs remappées en tons terre & forêt :
 *  - cream-*       : fond crème chaud + surfaces claires + borders
 *  - ink-*         : texte (du plus contrasté au plus discret)
 *  - olive-*       : accent primaire — vert forêt
 *  - sage-*        : accent élévation — vert doux
 *  - terracotta-*  : accent secondaire / alerts — terre cuite
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
        // Crème chaud (page → surfaces → borders)
        cream: {
          50: '#F4F1EA', // page background
          100: '#FCFBF7', // sheet, cards, FABs (blanc cassé chaud)
          200: '#E7E2D5', // borders
          300: '#D4CDBA', // borders forts / dividers
          400: '#A8A293', // texte ultra-discret
        },
        // Texte
        ink: {
          900: '#2A2A26',
          700: '#4A493F',
          500: '#6B6A60',
          400: '#8A8979',
          300: '#A8A293',
          200: '#C9C4B5',
          100: '#E7E2D5',
        },
        // Vert forêt (accent primaire)
        olive: {
          50: '#EBF2ED',
          100: '#D6E5DA',
          200: '#A9C9B0',
          400: '#4A8C5A',
          500: '#2F6B3F',
          700: '#275A35',
          800: '#21502F',
          900: '#2F6B3F',
        },
        // Vert doux (élévation)
        sage: {
          200: '#C9DCC0',
          400: '#7FA86B',
          600: '#4F8C5A',
        },
        // Terre cuite (accent secondaire / alerts)
        terracotta: {
          400: '#D17A56',
          500: '#C4623D',
          600: '#A04B2C',
        },
        // Couleurs polyline par type de chemin (synchro PATH_COLORS dans config.ts)
        terrain: {
          route: '#3E6E94',
          chemin: '#A9763F',
          single: '#4F8C5A',
          mixte: '#7C8579',
          unknown: '#A8A293',
        },
      },
      borderRadius: {
        sheet: '24px',
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        sheet: '0 -8px 32px -12px rgba(42, 42, 38, 0.20)',
        float: '0 4px 14px -4px rgba(42, 42, 38, 0.20), 0 1px 3px rgba(42, 42, 38, 0.08)',
        card: '0 1px 4px rgba(42, 42, 38, 0.06)',
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
        label: ['11px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.05em' }],
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-soft': 'cubic-bezier(0.55, 0, 0.55, 0.2)',
      },
      /* Échelle de calques centralisée (du fond vers l'avant). */
      zIndex: {
        map: '0', // carte plein écran
        hud: '20', // FABs, header flottant, légende
        overlay: '30', // scrim, barre d'édition, menu export
        panel: '40', // bottom sheet / sidebar flottante
        toast: '50', // overlay de chargement
      },
    },
  },
  plugins: [],
}
