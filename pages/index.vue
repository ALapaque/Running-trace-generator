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
import { historyEntryToRoute, useRouteHistory } from '../composables/useRouteHistory'
import { buildShareUrl, decodeParamsFromHash, encodeParams } from '../utils/share-url'
import type { AnalyzedRoute, GenerationParams } from '../types'
import type { LatLng } from '../types/ors'

type TabKey = 'details' | 'settings' | 'alternatives' | 'history'

const start = ref<LatLng | null>(null)
const selectedId = ref<string | null>(null)
const snap = ref<SheetSnap>('peek')
const activeTab = ref<TabKey>('settings')
let abort: AbortController | null = null

const pipeline = useRoutePipeline()
const history = useRouteHistory()
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

const selectedRoute = computed(() => {
  // Un parcours d'historique consulté prend le pas sur les résultats du pipeline.
  if (viewedHistoryRoute.value) return viewedHistoryRoute.value
  if (!selectedId.value) return pipeline.results.value[0] ?? null
  return pipeline.results.value.find((r) => r.id === selectedId.value) ?? null
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
  viewedHistoryRoute.value = null
  selectedId.value = id
}

function onReset(): void {
  abort?.abort()
  pipeline.reset()
  selectedId.value = null
  viewedHistoryRoute.value = null
  activeTab.value = 'settings'
}

// --- Historique ---
function onSelectHistory(id: string): void {
  const entry = history.list.value.find((e) => e.id === id)
  if (!entry) return
  viewedHistoryRoute.value = historyEntryToRoute(entry)
  activeTab.value = 'details'
  snap.value = 'mid'
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
    <!-- Carte plein écran — `z-0` + `isolate` isolent le stacking context
         Leaflet (panes 200/400/600/800) pour empêcher ses z-index internes
         de passer au-dessus du sheet et des FABs. -->
    <div class="absolute inset-0 z-0 isolate">
      <MapView
        ref="mapRef"
        :start="start"
        :route="selectedRoute"
        :bottom-inset="sheetBottomInset"
        @pickStart="onPickStart"
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

    <!-- Panneau : bottom sheet (mobile) ou sidebar flottante (desktop).
         Même API de slots → contenu défini une seule fois. -->
    <component :is="panelComponent" v-bind="panelProps">
      <!-- Header fixe : onglets (toujours visibles, hors scroll) -->
      <template #header>
        <SheetTabs v-model="activeTab" :tabs="tabs" />
      </template>

      <!-- Contenu par onglet -->
      <div v-if="activeTab === 'details' && selectedRoute" class="space-y-6 pt-1">
        <RouteStats :route="selectedRoute" />

        <!-- Pills difficulté / rythme -->
        <div class="flex flex-wrap gap-2">
          <span class="pill-active">
            Modéré
            <span class="text-[10px] uppercase opacity-80">Difficulté</span>
          </span>
          <span class="pill-muted">
            6 min/km
            <span class="text-[10px] uppercase opacity-60">Rythme</span>
          </span>
        </div>

        <ElevationChart :points="selectedRoute.points" />

        <!-- Répartition du terrain : affichée uniquement si l'analyse a réussi -->
        <TerrainBreakdown
          v-if="!selectedRoute.terrainFallback"
          :terrain="selectedRoute.terrain"
          :distance-m="selectedRoute.distanceM"
        />
      </div>

      <div v-else-if="activeTab === 'settings'" class="pt-1">
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

      <div v-else-if="activeTab === 'alternatives' && hasResults" class="pt-1">
        <RouteAlternatives
          :routes="pipeline.results.value"
          :selectedId="selectedId"
          @select="(id) => { onSelectRoute(id); activeTab = 'details' }"
        />
      </div>

      <div v-else-if="activeTab === 'history'" class="pt-1">
        <RouteHistory
          :entries="history.list.value"
          :selectedId="viewedHistoryId"
          @select="onSelectHistory"
          @remove="onRemoveHistory"
          @clear="onClearHistory"
        />
      </div>

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
