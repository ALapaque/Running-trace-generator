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
import { computed, ref, watch } from 'vue'
import BottomSheet, { type SheetSnap } from '../components/BottomSheet.vue'
import ControlPanel, { type ControlPanelSubmit } from '../components/ControlPanel.vue'
import ElevationChart from '../components/ElevationChart.vue'
import FloatingButton from '../components/FloatingButton.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import MapView from '../components/MapView.vue'
import RouteAlternatives from '../components/RouteAlternatives.vue'
import RouteStats from '../components/RouteStats.vue'
import SheetTabs, { type Tab } from '../components/SheetTabs.vue'
import TerrainBreakdown from '../components/TerrainBreakdown.vue'
import { useGpxExport } from '../composables/useGpxExport'
import { useRoutePipeline } from '../composables/useRoutePipeline'
import type { LatLng } from '../types/ors'

type TabKey = 'details' | 'settings' | 'alternatives'

const start = ref<LatLng | null>(null)
const selectedId = ref<string | null>(null)
const snap = ref<SheetSnap>('peek')
const activeTab = ref<TabKey>('settings')
let abort: AbortController | null = null

const pipeline = useRoutePipeline()
const gpx = useGpxExport()
const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const cpRef = ref<InstanceType<typeof ControlPanel> | null>(null)

function triggerSubmit(): void {
  cpRef.value?.submit()
}

const selectedRoute = computed(() => {
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
 * Hauteur (px) occupée par le bottom sheet selon son snap.
 * Passée à MapView pour réserver cet espace dans le fitBounds → le tracé
 * reste centré dans la portion de carte réellement visible.
 */
const sheetBottomInset = computed(() => {
  if (typeof window === 'undefined') return 200
  const vh = window.innerHeight
  switch (snap.value) {
    case 'full':
      return Math.round(vh * 0.9)
    case 'mid':
      return Math.round(vh * 0.55)
    default:
      return 200
  }
})

const tabs = computed<Tab[]>(() => [
  { key: 'details', label: 'Détails', disabled: !hasResults.value },
  { key: 'settings', label: 'Paramètres' },
  {
    key: 'alternatives',
    label: 'Alternatives',
    disabled: !hasResults.value,
    badge: hasResults.value ? pipeline.results.value.length : undefined,
  },
])

function onPickStart(pos: LatLng): void {
  start.value = pos
}

async function onSubmit(payload: ControlPanelSubmit): Promise<void> {
  abort?.abort()
  abort = new AbortController()
  const { resultsCount, ...input } = payload
  try {
    const top = await pipeline.run(input, { signal: abort.signal, resultsCount })
    selectedId.value = top[0]?.id ?? null
    activeTab.value = 'details'
    snap.value = 'mid'
  } catch {
    // L'erreur est gérée par le composable et affichée en bas du sheet.
  }
}

function onSelectRoute(id: string): void {
  selectedId.value = id
}

function onDownload(): void {
  if (selectedRoute.value) gpx.exportRoute(selectedRoute.value)
}

function onReset(): void {
  abort?.abort()
  pipeline.reset()
  selectedId.value = null
  activeTab.value = 'settings'
}

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
      <!-- Top-left : menu paramètres / piéton -->
      <div class="pointer-events-auto flex flex-col gap-2">
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
        <button
          v-if="selectedRoute"
          type="button"
          class="btn-primary"
          @click="onDownload"
          aria-label="Télécharger le parcours en GPX"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Enregistrer</span>
        </button>

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

    <!-- FABs droite : zoom + recenter (placés au-dessus du peek du sheet) -->
    <div
      class="pointer-events-none absolute right-3 z-20 flex flex-col gap-2"
      :style="{ bottom: `calc(${snap === 'peek' ? '180px' : snap === 'mid' ? '55dvh' : '88dvh'} + 12px)` }"
    >
      <div class="pointer-events-auto flex flex-col gap-2">
        <FloatingButton label="Rechercher" @click="(activeTab = 'settings'), (snap = 'full')">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </FloatingButton>
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

    <!-- Bottom sheet -->
    <BottomSheet v-model:snap="snap" :peek-px="200">
      <!-- Tabs sticky -->
      <div class="sticky top-0 z-10 -mx-4 mb-4 bg-cream-50 px-4 pb-3 pt-1">
        <SheetTabs v-model="activeTab" :tabs="tabs" />
      </div>

      <!-- Contenu par onglet -->
      <div v-if="activeTab === 'details' && selectedRoute" class="space-y-6">
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

      <div v-else-if="activeTab === 'settings'">
        <ControlPanel
          ref="cpRef"
          :start="start"
          :loading="loading"
          @submit="onSubmit"
          @pickStart="onPickStart"
        />
      </div>

      <div v-else-if="activeTab === 'alternatives' && hasResults">
        <RouteAlternatives
          :routes="pipeline.results.value"
          :selectedId="selectedId"
          @select="(id) => { onSelectRoute(id); activeTab = 'details' }"
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
        Aucun candidat dans la tolérance de ±7,5 % — les meilleurs hors gabarit sont retournés.
      </div>

      <!-- CTA Générer rendu dans le footer du sheet (toujours visible sur l'onglet Paramètres) -->
      <template v-if="activeTab === 'settings'" #footer>
        <button
          type="button"
          class="btn-primary w-full"
          :disabled="!start || loading"
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
    </BottomSheet>
  </div>
</template>
