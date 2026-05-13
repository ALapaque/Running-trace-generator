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
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        {
          name: 'description',
          content:
            'Génération de parcours de running personnalisés (round-trip) avec analyse du terrain (route, chemin, single, forêt) et export GPX.',
        },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
          integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
          crossorigin: '',
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      orsApiKey: '',
      orsBaseUrl: 'https://api.openrouteservice.org',
      overpassBaseUrl: 'https://overpass-api.de/api/interpreter',
      overpassFallbackUrl: 'https://overpass.kumi.systems/api/interpreter',
      nominatimBaseUrl: 'https://nominatim.openstreetmap.org',
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  css: ['~/assets/css/main.css'],
})
