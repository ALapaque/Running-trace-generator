// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: false,
  app: {
    head: {
      title: 'RunGen — Générateur de traces GPX',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          // `maximum-scale=1` + `user-scalable=no` empêche le pinch-zoom global
          // (l'app reste verrouillée à scale=1 — le scroll horizontal accidentel
          // après pinch sur mobile est très perturbant). `viewport-fit=cover`
          // permet aux `env(safe-area-inset-*)` de fonctionner sur les iPhone à
          // notch (utilisé p.ex. dans `UpdateBanner.vue`).
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
        {
          name: 'description',
          content:
            'Génération de parcours de running personnalisés (round-trip) avec analyse du terrain (route, chemin, single, forêt) et export GPX.',
        },
        { name: 'theme-color', content: '#2F6B3F' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'RunGen' },
      ],
      link: [
        // Police Inter — preconnect + stylesheet (chargement parallèle, pas
        // sérialisé derrière le CSS comme le ferait un @import).
        { rel: 'preconnect', href: 'https://rsms.me', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' },
        {
          rel: 'stylesheet',
          href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
          integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
          crossorigin: '',
        },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/icon.svg' },
      ],
    },
  },
  runtimeConfig: {
    // Clé ORS côté serveur — utilisée UNIQUEMENT par le proxy opt-in
    // (server/api/ors). Renseigner via NUXT_ORS_API_KEY. Laisser vide en
    // mode « zéro backend » (la clé publique est alors utilisée côté client).
    orsApiKey: '',
    public: {
      orsApiKey: '',
      // Mettre `/api/ors` pour router via le proxy serverless (clé masquée).
      orsBaseUrl: 'https://api.openrouteservice.org',
      overpassBaseUrl: 'https://overpass-api.de/api/interpreter',
      overpassFallbackUrl: 'https://overpass.kumi.systems/api/interpreter',
      nominatimBaseUrl: 'https://nominatim.openstreetmap.org',
      // BRouter — routage trail. Proxifié par /api/brouter/route (côté serveur).
      // Vider NUXT_PUBLIC_BROUTER_BASE_URL désactive le re-routage trail (→ ORS).
      // Pas de miroir public fiable trouvé : `brouterFallbackUrl` reste vide
      // (la dégradation gracieuse — fallback ORS par candidat + circuit breaker —
      // couvre une indisponibilité de brouter.de).
      brouterBaseUrl: 'https://brouter.de/brouter',
      brouterFallbackUrl: '',
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  css: ['~/assets/css/main.css'],
})
