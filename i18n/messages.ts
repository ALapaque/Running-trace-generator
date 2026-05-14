/**
 * Dictionnaires de traduction (FR / EN).
 *
 * Clés en notation pointée, résolues par `useI18n().t()`. Interpolation
 * `{param}`. Le français reste la langue de référence.
 */

export const fr = {
  app: { title: 'RunGen — générateur de traces de running GPX' },

  tabs: {
    settings: 'Paramètres',
    alternatives: 'Alternatives',
    history: 'Historique',
  },

  stats: {
    distance: 'Distance',
    time: 'Temps estimé',
    gain: 'Dénivelé',
    loss: 'Dén. nég.',
  },

  details: {
    difficulty: 'Difficulté',
    pace: 'Rythme',
    reverse: 'Sens inversé',
    edit: 'Ajuster le tracé',
    changePace: "Changer l'allure de course",
  },

  difficulty: {
    Facile: 'Facile',
    Modéré: 'Modéré',
    Soutenu: 'Soutenu',
    Difficile: 'Difficile',
    'Très difficile': 'Très difficile',
  },

  elevation: {
    title: 'Élévation',
    summary: 'Profil altimétrique sur {dist} km, altitude de {min} à {max} mètres.',
  },

  terrain: {
    title: 'Types de voies',
    route: 'Route',
    chemin_large: 'Chemin',
    single: 'Single track',
    unknown: 'Inconnu',
    forest: 'Portions en forêt :',
  },

  control: {
    start: 'Point de départ',
    searchPlaceholder: 'Recherche une adresse',
    useLocation: 'Utiliser ma position actuelle',
    locating: 'Localisation en cours',
    myLocation: 'Ma position',
    searching: 'Recherche en cours…',
    distance: 'Distance',
    elevation: 'Dénivelé positif',
    min: 'minimum',
    max: 'maximum',
    unconstrainedF: 'Non contrainte',
    unconstrainedM: 'Non contraint',
    atLeastOne: 'Active au moins la distance ou le dénivelé pour générer un parcours.',
    hillType: 'Type de côte',
    alternativesCount: 'Alternatives à proposer',
    quotaWarning:
      "Plus d'alternatives = plus de requêtes ORS consommées (~13 par génération).",
    generate: 'Générer le parcours',
    generating: 'Génération en cours…',
  },

  mode: {
    label: 'Type de course',
    running: 'Running',
    runningSub: 'Routes & bitume',
    trail: 'Trail',
    trailSub: 'Sentiers & forêt',
  },
  hillPref: {
    plat: 'Plat',
    vallonné: 'Vallonné',
    montagneux: 'Montagneux',
  },

  alternatives: {
    title: 'Alternatives',
    listLabel: 'Alternatives de parcours',
    score: 'score',
    dPlus: 'm D+',
  },

  history: {
    title: 'Historique',
    clearAll: 'Tout effacer',
    empty: "Aucun parcours généré pour l'instant. Tes prochains parcours apparaîtront ici.",
    remove: 'Supprimer le parcours du {date}',
  },

  export: {
    save: 'Enregistrer',
    viaShare: 'Via le partage système',
    downloadGpx: 'Télécharger le GPX',
    downloadGpxSub: 'Fichier .gpx (Strava, Komoot, montre…)',
    copyLink: 'Copier le lien',
    copyLinkSub: "Rouvre l'app avec ces paramètres",
    linkCopied: "Lien copié — il rouvre l'app avec ces paramètres.",
    importHintStrava: 'GPX téléchargé — importe-le dans l’onglet Strava ouvert.',
    importHintKomoot: 'GPX téléchargé — importe-le dans Komoot (onglet ouvert).',
  },

  loading: {
    generating: 'Génération du parcours…',
    analyzing: 'Analyse du terrain…',
    scoring: 'Sélection des meilleurs candidats…',
  },

  edit: {
    drag: 'Glisse les points pour ajuster',
    rerouting: 'Re-calcul du tracé…',
    cancel: 'Annuler',
    done: 'Terminé',
    error: 'Impossible de re-router par ce point (zone non accessible ?).',
  },

  panel: {
    label: 'Panneau du parcours',
    collapse: 'Replier le panneau',
    expand: 'Déplier le panneau',
    drag: 'Glisser pour redimensionner',
    sheetLabel: 'Détails du parcours',
  },

  fab: {
    openSettings: 'Ouvrir les paramètres',
    reset: 'Réinitialiser',
    search: 'Rechercher',
    recenter: 'Recentrer la carte',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
  },

  map: { label: 'Carte interactive du parcours' },

  warnings: {
    quotaPartial: 'Quota ORS partiellement consommé — les candidats restants ont été utilisés.',
    toleranceRelaxed:
      'Aucun candidat dans la plage de distance demandée — les meilleurs hors gabarit sont retournés.',
  },

  errors: {
    orsQuota:
      "Quota OpenRouteService dépassé pour aujourd'hui. Réessayez demain ou utilisez une autre clé.",
    orsKeyMissing:
      'Clé OpenRouteService manquante : définir NUXT_PUBLIC_ORS_API_KEY dans .env',
    unknown: 'Erreur inconnue',
  },

  geo: {
    unsupported: 'Géolocalisation non supportée par ce navigateur',
    denied: 'Permission refusée. Active la géolocalisation dans ton navigateur.',
    unavailable: 'Position indisponible (signal GPS faible ?).',
    timeout: 'La localisation a pris trop de temps. Réessaye.',
    error: 'Erreur de géolocalisation',
  },

  units: { minPerKm: 'min/km' },

  lang: { label: 'Langue' },
}

export const en: typeof fr = {
  app: { title: 'RunGen — GPX running route generator' },

  tabs: {
    settings: 'Settings',
    alternatives: 'Alternatives',
    history: 'History',
  },

  stats: {
    distance: 'Distance',
    time: 'Est. time',
    gain: 'Elevation',
    loss: 'Descent',
  },

  details: {
    difficulty: 'Difficulty',
    pace: 'Pace',
    reverse: 'Reversed',
    edit: 'Adjust route',
    changePace: 'Change running pace',
  },

  difficulty: {
    Facile: 'Easy',
    Modéré: 'Moderate',
    Soutenu: 'Sustained',
    Difficile: 'Hard',
    'Très difficile': 'Very hard',
  },

  elevation: {
    title: 'Elevation',
    summary: 'Elevation profile over {dist} km, altitude from {min} to {max} metres.',
  },

  terrain: {
    title: 'Path types',
    route: 'Road',
    chemin_large: 'Track',
    single: 'Single track',
    unknown: 'Unknown',
    forest: 'In-forest portions:',
  },

  control: {
    start: 'Start point',
    searchPlaceholder: 'Search an address',
    useLocation: 'Use my current location',
    locating: 'Locating',
    myLocation: 'My location',
    searching: 'Searching…',
    distance: 'Distance',
    elevation: 'Elevation gain',
    min: 'minimum',
    max: 'maximum',
    unconstrainedF: 'Unconstrained',
    unconstrainedM: 'Unconstrained',
    atLeastOne: 'Enable at least distance or elevation to generate a route.',
    hillType: 'Hill profile',
    alternativesCount: 'Alternatives to propose',
    quotaWarning: 'More alternatives = more ORS requests used (~13 per generation).',
    generate: 'Generate route',
    generating: 'Generating…',
  },

  mode: {
    label: 'Run type',
    running: 'Running',
    runningSub: 'Roads & pavement',
    trail: 'Trail',
    trailSub: 'Paths & forest',
  },
  hillPref: {
    plat: 'Flat',
    vallonné: 'Rolling',
    montagneux: 'Mountainous',
  },

  alternatives: {
    title: 'Alternatives',
    listLabel: 'Route alternatives',
    score: 'score',
    dPlus: 'm gain',
  },

  history: {
    title: 'History',
    clearAll: 'Clear all',
    empty: 'No route generated yet. Your next routes will show up here.',
    remove: 'Delete the route from {date}',
  },

  export: {
    save: 'Save',
    viaShare: 'Via the system share sheet',
    downloadGpx: 'Download GPX',
    downloadGpxSub: '.gpx file (Strava, Komoot, watch…)',
    copyLink: 'Copy link',
    copyLinkSub: 'Reopens the app with these parameters',
    linkCopied: 'Link copied — it reopens the app with these parameters.',
    importHintStrava: 'GPX downloaded — import it in the open Strava tab.',
    importHintKomoot: 'GPX downloaded — import it in Komoot (open tab).',
  },

  loading: {
    generating: 'Generating route…',
    analyzing: 'Analysing terrain…',
    scoring: 'Selecting the best candidates…',
  },

  edit: {
    drag: 'Drag the points to adjust',
    rerouting: 'Recomputing route…',
    cancel: 'Cancel',
    done: 'Done',
    error: 'Could not reroute through this point (unreachable area?).',
  },

  panel: {
    label: 'Route panel',
    collapse: 'Collapse panel',
    expand: 'Expand panel',
    drag: 'Drag to resize',
    sheetLabel: 'Route details',
  },

  fab: {
    openSettings: 'Open settings',
    reset: 'Reset',
    search: 'Search',
    recenter: 'Recenter map',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },

  map: { label: 'Interactive route map' },

  warnings: {
    quotaPartial: 'ORS quota partially used — the remaining candidates were used.',
    toleranceRelaxed:
      'No candidate within the requested distance range — the closest off-range ones are returned.',
  },

  errors: {
    orsQuota:
      'OpenRouteService quota exceeded for today. Try again tomorrow or use another key.',
    orsKeyMissing:
      'Missing OpenRouteService key: set NUXT_PUBLIC_ORS_API_KEY in .env',
    unknown: 'Unknown error',
  },

  geo: {
    unsupported: 'Geolocation is not supported by this browser',
    denied: 'Permission denied. Enable location access in your browser.',
    unavailable: 'Location unavailable (weak GPS signal?).',
    timeout: 'Locating took too long. Try again.',
    error: 'Geolocation error',
  },

  units: { minPerKm: 'min/km' },

  lang: { label: 'Language' },
}
