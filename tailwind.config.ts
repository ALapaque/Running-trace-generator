import type { Config } from 'tailwindcss'

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
        // Couleurs par type de chemin (synchronisées avec PATH_COLORS dans config.ts)
        terrain: {
          route: '#2563eb',
          chemin: '#a16207',
          single: '#16a34a',
          mixte: '#64748b',
          unknown: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
