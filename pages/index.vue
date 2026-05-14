<script setup lang="ts">
/**
 * Layout Komoot-like : carte plein écran + bottom sheet drag-resize.
 *
 * Snap points :
 *  - peek : aperçu (poignée, tabs, stats)
 *  - mid  : carte visible au-dessus, sheet à 55% de la hauteur
 *  - full : sheet quasi plein écran (tabs en sticky)
 *
 * Boutons flottants :
 *  - Top-left : menu (paramètres, raccourcis)
 *  - Top-right : enregistrer (GPX) + close (réinitialiser)
 *  - Bottom-right (au-dessus du sheet peek) : zoom in/out, recenter
 */
import { computed, onMounted, ref, watch } from 'vue'
import BottomSheet, { type SheetSnap } from '../components/BottomSheet.vue'
import ControlPanel, { type ControlPanelSubmit } from '../components/ControlPanel.vue'
import ElevationChart from '../components/ElevationChart.vue'
import ExportMenu from '../components/ExportMenu.vue'
import FloatingButton from '../components/FloatingButton.vue'
import FloatingPanel from '../components/FloatingPanel.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import MapView from '../components/MapView.vue'
import RouteAlternatives from '../components/RouteAlternatives.vue'
import RouteHistory from '../components/RouteHistory.vue'
import RouteStats from '../components/RouteStats.vue'
import SheetTabs, { type Tab } from '../components/SheetTabs.vue'
import TerrainBreakdown from '../components/TerrainBreakdown.vue'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useRoutePipeline } from '../composables/useRoutePipeline'
import { useRouteGenerator } from '../composables/useRouteGenerator'
import { useRouteHistory, historyEntryToRoute } from '../composables/useRouteHistory'
import { useRunnerPace } from '../composables/useRunnerPace'
import { buildShareUrl, decodeParamsFromHash, encodeParams } from '../utils/share-url'
import { reverseRoute } from '../utils/route-ops'
import { climbConcentration } from '../utils/climbs'
import { computeDifficulty } from '../utils/difficulty'
import { formatPace } from '../utils/pace'
import type { AnalyzedRoute, GenerationParams, RouteCandidate, TerrainStats } from '../types'
import type { LatLng } from '../types/ors'

type TabKey = 'details' | 'settings' | 'alternatives' | 'history'

const start = ref<LatLng | null>(null)
const selectedId = ref<string | null>(null)
const snap = ref<SheetSnap>('peek')
const activeTab = ref<TabKey>('settings')
let abort: AbortController | null = null

const pipeline = useRoutePipeline()
const history = useRouteHistory()
const { pace, cycle: cyclePace } = useRunnerPace()
const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const cpRef = ref<InstanceType<typeof ControlPanel> | null>(null)
/** Validité du formulaire (départ défini + au moins distance ou dénivelé actif). */
const formValid = ref(false)
/** Paramètres décodés depuis le hash de l'URL au chargement (prefill du formulaire). */
const initialParams = ref<GenerationParams | null>(null)
/** Derniers paramètres soumis (pour le hash d'URL + le lien de partage). */
const lastParams = ref<GenerationParams | null>(null)
/** Parcours d'historique actuellement affiché (prioritaire sur les résultats du pipeline). */
const viewedHistoryRoute = ref<AnalyzedRoute | null>(null)
/** Sens inversé du parcours affiché (transformation locale, sans appel réseau). */
const reversed = ref(false)

// --- Édition manuelle du tracé ---
const { routeThroughWaypoints } = useRouteGenerator()
/** Mode édition actif. */
const editMode = ref(false)
/** Waypoints déplaçables (0 = départ). Source de vérité de l'édition. */
const editableWaypoints = ref<LatLng[]>([])
/** Parcours re-calculé suite à une édition (override d'affichage). */
const editedRoute = ref<AnalyzedRoute | null>(null)
/** Re-routage ORS en cours. */
const editRerouting = ref(false)
const editError = ref<string | null>(null)
let editedRouteBeforeEdit: AnalyzedRoute | null = null
let editAbort: AbortController | null = null

const EMPTY_TERRAIN: TerrainStats = {
  route: 0,
  chemin_large: 0,
  single: 0,
  mixte: 0,
  forest: 0,
  unknown: 1,
}

/** Construit un AnalyzedRoute affichable depuis un candidat ré-routé (terrain non analysé). */
function candidateToRoute(c: RouteCandidate): AnalyzedRoute {
  return {
    ...c,
    terrain: EMPTY_TERRAIN,
    segments: [],
    score: 0,
    scoreBreakdown: { distance: 0, elevation: 0, terrain: 0, forest: 0, profile: 0 },
    climbConcentration: climbConcentration(c.points),
    terrainFallback: true,
  }
}

// Desktop ≥ 1024px → sidebar flottante draggable ; sinon bottom sheet.
const isDesktop = useMediaQuery('(min-width: 1024px)')
const panelComponent = computed(() => (isDesktop.value ? FloatingPanel : BottomSheet))
const panelProps = computed(() =>
  isDesktop.value
    ? {}
    : {
        snap: snap.value,
        'onUpdate:snap': (v: SheetSnap) => {
          snap.value = v
        },
        peekPx: 172,
      },
)

function triggerSubmit(): void {
  cpRef.value?.submit()
}

const baseRoute = computed<AnalyzedRoute | null>(() => {
  // Un parcours édité prend le pas, puis un parcours d'historique consulté,
  // puis les résultats du pipeline.
  if (editedRoute.value) return editedRoute.value
  if (viewedHistoryRoute.value) return viewedHistoryRoute.value
  if (!selectedId.value) return pipeline.results.value[0] ?? null
  return pipeline.results.value.find((r) => r.id === selectedId.value) ?? null
})

const selectedRoute = computed<AnalyzedRoute | null>(() =>
  baseRoute.value && reversed.value ? reverseRoute(baseRoute.value) : baseRoute.value,
)

/** Difficulté estimée du parcours affiché (distance + D+ + technicité). */
const difficulty = computed(() => {
  const r = selectedRoute.value
  if (!r) return null
  return computeDifficulty(
    r.distanceM,
    r.elevationGainM,
    r.terrainFallback ? 0 : r.terrain.single,
  )
})

const loading = computed(
  () =>
    pipeline.stage.value === 'generating' ||
    pipeline.stage.value === 'analyzing' ||
    pipeline.stage.value === 'scoring',
)

const hasResults = computed(() => pipeline.results.value.length > 0)

/**
 * Espace (px) à réserver en bas du fitBounds.
 * - Mobile : hauteur du bottom sheet selon son snap.
 * - Desktop : 0 — la sidebar flotte sur un coin et est déplaçable, on ne
 *   réserve donc pas d'espace fixe.
 */
const sheetBottomInset = computed(() => {
  if (isDesktop.value || typeof window === 'undefined') return 0
  const vh = window.innerHeight
  switch (snap.value) {
    case 'full':
      return Math.round(vh * 0.9)
    case 'mid':
      return Math.round(vh * 0.55)
    default:
      return 172
  }
})

/** Position du cluster de FABs zoom/recentrage (au-dessus du sheet sur mobile). */
const fabClusterStyle = computed(() => {
  if (isDesktop.value) return { bottom: '24px' }
  const base = snap.value === 'peek' ? '180px' : snap.value === 'mid' ? '55dvh' : '88dvh'
  return { bottom: `calc(${base} + 12px)` }
})

const tabs = computed<Tab[]>(() => [
  { key: 'details', label: 'Détails', disabled: !selectedRoute.value },
  { key: 'settings', label: 'Paramètres' },
  {
    key: 'alternatives',
    label: 'Alternatives',
    disabled: !hasResults.value,
    badge: hasResults.value ? pipeline.results.value.length : undefined,
  },
  {
    key: 'history',
    label: 'Historique',
    badge: history.list.value.length || undefined,
  },
])

function onPickStart(pos: LatLng): void {
  start.value = pos
}

async function onSubmit(payload: ControlPanelSubmit): Promise<void> {
  abort?.abort()
  abort = new AbortController()
  const { resultsCount, ...input } = payload
  // Mémorise les paramètres : hash d'URL partageable + lien d'export.
  lastParams.value = { ...payload }
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', `#${encodeParams(payload)}`)
  }
  try {
    viewedHistoryRoute.value = null
    reversed.value = false
    clearEditState()
    const top = await pipeline.run(input, { signal: abort.signal, resultsCount })
    selectedId.value = top[0]?.id ?? null
    if (top[0]) history.add(top[0])
    activeTab.value = 'details'
    snap.value = 'mid'
  } catch {
    // L'erreur est gérée par le composable et affichée en bas du sheet.
  }
}

function onSelectRoute(id: string): void {
  clearEditState()
  viewedHistoryRoute.value = null
  reversed.value = false
  selectedId.value = id
}

function onReset(): void {
  abort?.abort()
  pipeline.reset()
  clearEditState()
  selectedId.value = null
  viewedHistoryRoute.value = null
  reversed.value = false
  activeTab.value = 'settings'
}

// --- Historique ---
function onSelectHistory(id: string): void {
  const entry = history.list.value.find((e) => e.id === id)
  if (!entry) return
  clearEditState()
  viewedHistoryRoute.value = historyEntryToRoute(entry)
  reversed.value = false
  activeTab.value = 'details'
  snap.value = 'mid'
}

// --- Édition manuelle du tracé ---
/** Échantillonne `count` waypoints intermédiaires + le départ depuis un parcours. */
function sampleWaypoints(route: AnalyzedRoute, count = 6): LatLng[] {
  const pts = route.points
  const wps: LatLng[] = [{ lat: pts[0]!.lat, lng: pts[0]!.lng }]
  for (let i = 1; i <= count; i++) {
    const idx = Math.min(pts.length - 1, Math.floor((pts.length / (count + 1)) * i))
    wps.push({ lat: pts[idx]!.lat, lng: pts[idx]!.lng })
  }
  return wps
}

function enterEditMode(): void {
  const route = selectedRoute.value
  if (!route) return
  editedRouteBeforeEdit = editedRoute.value
  editableWaypoints.value = sampleWaypoints(route)
  reversed.value = false
  editError.value = null
  editMode.value = true
  snap.value = 'peek' // dégage la carte pour glisser les points
}

async function onWaypointMoved(index: number, pos: LatLng): Promise<void> {
  editableWaypoints.value = editableWaypoints.value.map((w, i) => (i === index ? pos : w))
  editAbort?.abort()
  editAbort = new AbortController()
  editRerouting.value = true
  editError.value = null
  try {
    const loop = [...editableWaypoints.value, editableWaypoints.value[0]!]
    const candidate = await routeThroughWaypoints(loop, editAbort.signal)
    editedRoute.value = candidateToRoute(candidate)
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') {
      editError.value = 'Impossible de re-router par ce point (zone non accessible ?).'
    }
  } finally {
    editRerouting.value = false
  }
}

function exitEditMode(save: boolean): void {
  editAbort?.abort()
  editMode.value = false
  editRerouting.value = false
  editError.value = null
  if (!save) editedRoute.value = editedRouteBeforeEdit
  editedRouteBeforeEdit = null
  editableWaypoints.value = []
}

function clearEditState(): void {
  editAbort?.abort()
  editMode.value = false
  editedRoute.value = null
  editableWaypoints.value = []
  editError.value = null
  editRerouting.value = false
  editedRouteBeforeEdit = null
}

const viewedHistoryId = computed(() =>
  viewedHistoryRoute.value && history.list.value.some((e) => e.id === viewedHistoryRoute.value!.id)
    ? viewedHistoryRoute.value.id
    : null,
)

function onRemoveHistory(id: string): void {
  history.remove(id)
  if (viewedHistoryRoute.value?.id === id) viewedHistoryRoute.value = null
}

function onClearHistory(): void {
  history.clear()
  viewedHistoryRoute.value = null
}

// Restaure les paramètres depuis le hash de l'URL au chargement (lien partagé).
onMounted(() => {
  const decoded = decodeParamsFromHash(window.location.hash)
  if (decoded) {
    initialParams.value = decoded
    start.value = decoded.start
    activeTab.value = 'settings'
  }
})

// Quand on bascule sur l'onglet Paramètres, déplie la sheet pour montrer le formulaire.
watch(activeTab, (t) => {
  if (t === 'settings' && snap.value === 'peek') snap.value = 'full'
})
</script>

<template>
  <div class="relative h-dvh w-screen overflow-hidden bg-cream-50">
    <h1 class="sr-only">RunGen — générateur de traces de running GPX</h1>
    <!-- Carte plein écran — `z-0` + `isolate` isolent le stacking context
         Leaflet (panes 200/400/600/800) pour empêcher ses z-index internes
         de passer au-dessus du sheet et des FABs. -->
    <div class="absolute inset-0 z-0 isolate">
      <MapView
        ref="mapRef"
        :start="start"
        :route="selectedRoute"
        :bottom-inset="sheetBottomInset"
        :editable="editMode"
        :editable-waypoints="editableWaypoints"
        @pickStart="onPickStart"
        @waypointMoved="onWaypointMoved"
      />
    </div>

    <!-- Header flottant (top-left + top-right) -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
      style="padding-top: max(0.75rem, env(safe-area-inset-top));"
    >
      <!-- Top-left : menu paramètres / piéton (mobile uniquement —
           sur desktop la sidebar flottante remplace ces raccourcis) -->
      <div v-if="!isDesktop" class="pointer-events-auto flex flex-col gap-2">
         <FloatingButton
          label="Ouvrir les paramètres"
          @click="(activeTab = 'settings'), (snap = 'full')"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </FloatingButton>

         <FloatingButton
          label="Mode course à pied"
          :active="true"
        >
          <!-- Pictogramme coureur -->
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="13" cy="4" r="2" />
            <path d="M4 22l3-7 4 2 2-3 3 4 4-2" />
            <path d="M9 13l3-5 4 3-2 4" />
          </svg>
        </FloatingButton>
      </div>

      <!-- Top-right : Enregistrer + reset -->
      <div class="pointer-events-auto flex items-center gap-2">
        <ExportMenu v-if="selectedRoute" :route="selectedRoute" :params="lastParams" />

         <FloatingButton
          v-if="hasResults"
          label="Réinitialiser"
          @click="onReset"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </FloatingButton>
      </div>
    </div>

    <!-- FABs droite : zoom + recenter (au-dessus du sheet sur mobile,
         coin bas-droit fixe sur desktop) -->
    <div
      class="pointer-events-none absolute right-3 z-20 flex flex-col gap-2"
      :style="fabClusterStyle"
    >
      <div class="pointer-events-auto flex flex-col gap-2">
        <FloatingButton label="Recentrer la carte" @click="mapRef?.recenter()">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </FloatingButton>
        <FloatingButton label="Zoom avant" small @click="mapRef?.zoomIn()">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </FloatingButton>
        <FloatingButton label="Zoom arrière" small @click="mapRef?.zoomOut()">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </FloatingButton>
      </div>
    </div>

    <!-- Loading overlay (toast en haut) -->
    <LoadingOverlay :stage="pipeline.stage.value" :progress="pipeline.progress.value" />

    <!-- Barre d'édition du tracé (mode édition) -->
    <div
      v-if="editMode"
      class="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3"
      style="padding-top: max(0.75rem, env(safe-area-inset-top));"
    >
      <div
        class="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-pill bg-cream-100 px-4 py-2.5 shadow-float ring-1 ring-cream-200"
      >
        <svg
          v-if="editRerouting"
          class="h-4 w-4 shrink-0 animate-spin text-olive-900"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span class="text-sm font-medium text-ink-900">
          {{ editRerouting ? 'Re-calcul du tracé…' : 'Glisse les points pour ajuster' }}
        </span>
        <button
          type="button"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-cream-200"
          @click="exitEditMode(false)"
        >
          Annuler
        </button>
        <button
          type="button"
          class="rounded-pill bg-olive-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-olive-800"
          @click="exitEditMode(true)"
        >
          Terminé
        </button>
      </div>
    </div>

    <!-- Erreur d'édition (toast court) -->
    <div
      v-if="editError"
      class="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center p-3"
      role="alert"
    >
      <div class="pointer-events-auto rounded-pill bg-terracotta-500/15 px-4 py-2 text-xs text-terracotta-600">
        {{ editError }}
      </div>
    </div>

    <!-- Panneau : bottom sheet (mobile) ou sidebar flottante (desktop).
         Même API de slots → contenu défini une seule fois. -->
    <component :is="panelComponent" v-bind="panelProps">
      <!-- Header fixe : onglets (toujours visibles, hors scroll) -->
      <template #header>
        <SheetTabs v-model="activeTab" :tabs="tabs" />
      </template>

      <!-- Contenu par onglet — transition douce out-in entre onglets -->
      <Transition name="tab" mode="out-in">
        <div
          v-if="activeTab === 'details' && selectedRoute"
          key="details"
          class="space-y-6 pt-1"
        >
          <div class="animate-reveal">
            <RouteStats :route="selectedRoute" :pace="pace" />
          </div>

          <!-- Pills difficulté (calculée) / rythme (réglable) + inversion du sens -->
          <div
            class="animate-reveal flex flex-wrap items-center gap-2"
            style="animation-delay: 60ms"
          >
          <span class="pill-active">
            {{ difficulty?.level }}
            <span class="text-[10px] uppercase opacity-80">Difficulté</span>
          </span>
          <button
            type="button"
            class="pill-muted"
            aria-label="Changer l'allure de course"
            @click="cyclePace"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="7 10 12 5 17 10" />
              <polyline points="7 14 12 19 17 14" />
            </svg>
            {{ formatPace(pace) }} min/km
            <span class="text-[10px] uppercase opacity-60">Rythme</span>
          </button>
          <button
            type="button"
            :class="reversed ? 'pill-active' : 'pill-muted'"
            :aria-pressed="reversed"
            @click="reversed = !reversed"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Sens inversé
          </button>
          <button type="button" class="pill-muted" @click="enterEditMode">
            <svg
              viewBox="0 0 24 24"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
              Ajuster le tracé
            </button>
          </div>

          <div class="animate-reveal" style="animation-delay: 120ms">
            <ElevationChart :points="selectedRoute.points" />
          </div>

          <!-- Répartition du terrain : affichée uniquement si l'analyse a réussi -->
          <div
            v-if="!selectedRoute.terrainFallback"
            class="animate-reveal"
            style="animation-delay: 180ms"
          >
            <TerrainBreakdown
              :terrain="selectedRoute.terrain"
              :distance-m="selectedRoute.distanceM"
            />
          </div>
        </div>

        <div v-else-if="activeTab === 'settings'" key="settings" class="pt-1">
          <ControlPanel
            ref="cpRef"
            :start="start"
            :loading="loading"
            :initial="initialParams"
            @submit="onSubmit"
            @pickStart="onPickStart"
            @update:valid="formValid = $event"
          />
        </div>

        <div
          v-else-if="activeTab === 'alternatives' && hasResults"
          key="alternatives"
          class="pt-1"
        >
          <RouteAlternatives
            :routes="pipeline.results.value"
            :selectedId="selectedId"
            @select="(id) => { onSelectRoute(id); activeTab = 'details' }"
          />
        </div>

        <div v-else-if="activeTab === 'history'" key="history" class="pt-1">
          <RouteHistory
            :entries="history.list.value"
            :selectedId="viewedHistoryId"
            :pace="pace"
            @select="onSelectHistory"
            @remove="onRemoveHistory"
            @clear="onClearHistory"
          />
        </div>
      </Transition>

      <!-- Erreurs / warnings -->
      <div
        v-if="pipeline.errorMessage.value"
        class="mt-4 rounded-card bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600"
        role="alert"
      >
        {{ pipeline.errorMessage.value }}
      </div>
      <div
        v-else-if="pipeline.quotaWarning.value"
        class="mt-4 rounded-card bg-cream-100 px-4 py-3 text-xs text-ink-700"
      >
        Quota ORS partiellement consommé — les candidats restants ont été utilisés.
      </div>
      <div
        v-if="pipeline.distanceToleranceRelaxed.value"
        class="mt-2 rounded-card bg-cream-100 px-4 py-3 text-xs text-terracotta-600"
      >
        Aucun candidat dans la plage de distance demandée — les meilleurs hors gabarit sont retournés.
      </div>

      <!-- CTA Générer rendu dans le footer du sheet (toujours visible sur l'onglet Paramètres) -->
      <template v-if="activeTab === 'settings'" #footer>
        <button
          type="button"
          class="btn-primary w-full"
          :disabled="!formValid || loading"
          @click="triggerSubmit"
        >
          <span v-if="loading" class="inline-flex items-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            </svg>
            Génération en cours…
          </span>
          <span v-else class="inline-flex items-center gap-2">
            Générer le parcours
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </button>
      </template>
    </component>
  </div>
</template>
