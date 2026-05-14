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
import ExportMenu from '../components/ExportMenu.vue'
import FlagIcon from '../components/FlagIcon.vue'
import FloatingButton from '../components/FloatingButton.vue'
import FloatingPanel from '../components/FloatingPanel.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import MapLegend from '../components/MapLegend.vue'
import MapView from '../components/MapView.vue'
import RouteAlternatives from '../components/RouteAlternatives.vue'
import RouteDetail from '../components/RouteDetail.vue'
import RouteHistory from '../components/RouteHistory.vue'
import SheetTabs, { type Tab } from '../components/SheetTabs.vue'
import { useMediaQuery } from '../composables/useMediaQuery'
import { LOCALES, useI18n } from '../composables/useI18n'
import { useRoutePipeline } from '../composables/useRoutePipeline'
import { useRouteGenerator } from '../composables/useRouteGenerator'
import { useRouteHistory, historyEntryToRoute } from '../composables/useRouteHistory'
import { useRunnerPace } from '../composables/useRunnerPace'
import { useLastResults } from '../composables/useLastResults'
import { buildShareUrl, decodeParamsFromHash, encodeParams } from '../utils/share-url'
import { reverseRoute } from '../utils/route-ops'
import { climbConcentration } from '../utils/climbs'
import type { AnalyzedRoute, GenerationParams, RouteCandidate, TerrainStats } from '../types'
import type { LatLng, RoutePoint } from '../types/ors'

type TabKey = 'settings' | 'alternatives' | 'history'

const start = ref<LatLng | null>(null)
const selectedId = ref<string | null>(null)
const snap = ref<SheetSnap>('peek')
const activeTab = ref<TabKey>('settings')
let abort: AbortController | null = null

const pipeline = useRoutePipeline()
const history = useRouteHistory()
const lastResults = useLastResults()
const { pace, cycle: cyclePace } = useRunnerPace()
const { t, locale, setLocale } = useI18n()
const mapRef = ref<InstanceType<typeof MapView> | null>(null)

/** Bascule la langue (FR ↔ EN). */
function cycleLocale(): void {
  const idx = LOCALES.indexOf(locale.value)
  setLocale(LOCALES[(idx + 1) % LOCALES.length]!)
}
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
/** Point survolé sur le profil altimétrique — matérialisé sur la carte. */
const highlightPoint = ref<RoutePoint | null>(null)

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

/** Alternative dépliée : aucune si on consulte un parcours d'historique. */
const alternativesExpandedId = computed(() =>
  viewedHistoryRoute.value ? null : selectedId.value,
)

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

/**
 * Position du cluster de FABs zoom/recentrage (et de la légende), au-dessus du
 * sheet sur mobile. `env(safe-area-inset-bottom)` dégage la barre gestuelle.
 */
const fabClusterStyle = computed(() => {
  if (isDesktop.value) {
    return { bottom: 'calc(24px + env(safe-area-inset-bottom))' }
  }
  const base = snap.value === 'peek' ? '180px' : snap.value === 'mid' ? '55dvh' : '88dvh'
  return { bottom: `calc(${base} + 12px + env(safe-area-inset-bottom))` }
})

/**
 * Overlays carte (cluster FAB + légende) masqués quand le sheet `full` couvre
 * la carte : ils remonteraient se coller au header et l'encombrer.
 */
const showMapOverlays = computed(() => isDesktop.value || snap.value !== 'full')

const tabs = computed<Tab[]>(() => [
  { key: 'settings', label: t('tabs.settings') },
  {
    key: 'alternatives',
    label: t('tabs.alternatives'),
    disabled: !hasResults.value,
    badge: hasResults.value ? pipeline.results.value.length : undefined,
  },
  {
    key: 'history',
    label: t('tabs.history'),
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
    // Persiste la session : un reload restaure alternatives + sélection.
    lastResults.saveResults(pipeline.results.value, selectedId.value, lastParams.value)
    activeTab.value = 'alternatives'
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
  lastResults.saveSelectedId(id)
}

function onReset(): void {
  abort?.abort()
  pipeline.reset()
  clearEditState()
  lastResults.clear()
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
  activeTab.value = 'history'
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
      editError.value = t('edit.error')
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

// Au chargement : lien partagé (hash URL) prioritaire, sinon restauration
// de la dernière session générée (alternatives + sélection) depuis localStorage.
onMounted(() => {
  const decoded = decodeParamsFromHash(window.location.hash)
  if (decoded) {
    initialParams.value = decoded
    start.value = decoded.start
    activeTab.value = 'settings'
    return
  }
  const session = lastResults.stored.value
  if (session.results.length) {
    pipeline.restore(session.results)
    selectedId.value = session.selectedId
    lastParams.value = session.params
    if (session.params) start.value = session.params.start
    activeTab.value = 'alternatives'
    snap.value = 'mid'
  }
})

// Quand on bascule sur l'onglet Paramètres, déplie la sheet pour montrer le formulaire.
watch(activeTab, (t) => {
  if (t === 'settings' && snap.value === 'peek') snap.value = 'full'
})

// Changer de parcours affiché retire la pastille de survol du profil.
watch(selectedRoute, () => {
  highlightPoint.value = null
})
</script>

<template>
  <div class="relative h-dvh w-screen overflow-hidden bg-cream-50">
    <h1 class="sr-only">{{ t('app.title') }}</h1>
    <!-- Carte plein écran — `z-map` + `isolate` isolent le stacking context
         Leaflet (panes 200/400/600/800) pour empêcher ses z-index internes
         de passer au-dessus du sheet et des FABs. -->
    <div class="absolute inset-0 z-map isolate">
      <MapView
        ref="mapRef"
        :start="start"
        :route="selectedRoute"
        :bottom-inset="sheetBottomInset"
        :editable="editMode"
        :editable-waypoints="editableWaypoints"
        :highlight-point="highlightPoint"
        @pickStart="onPickStart"
        @waypointMoved="onWaypointMoved"
      />
    </div>

    <!-- Header flottant : sélecteur de langue (+ raccourcis mobile). -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-hud flex items-start justify-between p-3"
      style="padding-top: max(0.75rem, env(safe-area-inset-top));"
    >
      <!-- Top-left : sélecteur de langue (toujours) + raccourcis paramètres
           (mobile uniquement — sur desktop la sidebar les remplace) -->
      <div class="pointer-events-auto flex flex-col gap-2">
        <FloatingButton :label="t('lang.label')" @click="cycleLocale">
          <FlagIcon :locale="locale" />
        </FloatingButton>

        <template v-if="!isDesktop">
          <FloatingButton
            :label="t('fab.openSettings')"
            @click="(activeTab = 'settings'), (snap = 'full')"
          >
            <Icon name="settings" class="h-5 w-5" />
          </FloatingButton>
        </template>
      </div>
    </div>

    <!-- Enregistrer + réinitialiser : haut-droite sur mobile, bas-gauche sur
         desktop (la sidebar occupe le haut-droite). -->
    <div
      v-if="selectedRoute || hasResults"
      class="pointer-events-auto absolute z-hud flex items-center gap-2"
      :class="isDesktop ? 'bottom-6 left-6' : 'right-3'"
      :style="isDesktop ? undefined : { top: 'max(0.75rem, env(safe-area-inset-top))' }"
    >
      <ExportMenu
        v-if="selectedRoute"
        :route="selectedRoute"
        :params="lastParams"
        :drop-up="isDesktop"
      />

      <FloatingButton v-if="hasResults" :label="t('fab.reset')" @click="onReset">
        <Icon name="close" class="h-5 w-5" />
      </FloatingButton>
    </div>

    <!-- FABs droite : zoom + recenter (au-dessus du sheet sur mobile,
         coin bas-droit fixe sur desktop) -->
    <div
      v-show="showMapOverlays"
      class="pointer-events-none absolute right-3 z-hud flex flex-col gap-2"
      :style="fabClusterStyle"
    >
      <div class="pointer-events-auto flex flex-col gap-2">
        <FloatingButton :label="t('fab.recenter')" @click="mapRef?.recenter()">
          <Icon name="locate" class="h-5 w-5" />
        </FloatingButton>
        <FloatingButton :label="t('fab.zoomIn')" small @click="mapRef?.zoomIn()">
          <Icon name="plus" class="h-4 w-4" />
        </FloatingButton>
        <FloatingButton :label="t('fab.zoomOut')" small @click="mapRef?.zoomOut()">
          <Icon name="minus" class="h-4 w-4" />
        </FloatingButton>
      </div>
    </div>

    <!-- Légende du tracé (bas-gauche) — clé des couleurs de la polyline.
         Suit la même hauteur que le cluster de FABs (au-dessus du sheet). -->
    <div
      v-if="showMapOverlays && selectedRoute && !selectedRoute.terrainFallback && !editMode"
      class="pointer-events-none absolute left-3 z-hud flex"
      :style="fabClusterStyle"
    >
      <MapLegend class="pointer-events-auto" :terrain="selectedRoute.terrain" />
    </div>

    <!-- Loading overlay (toast en haut) -->
    <LoadingOverlay :stage="pipeline.stage.value" :progress="pipeline.progress.value" />

    <!-- Barre d'édition du tracé (mode édition) -->
    <div
      v-if="editMode"
      class="pointer-events-none absolute inset-x-0 top-0 z-overlay flex justify-center p-3"
      style="padding-top: max(0.75rem, env(safe-area-inset-top));"
    >
      <div
        class="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-pill bg-cream-100 px-4 py-2.5 shadow-float ring-1 ring-cream-300"
      >
        <Icon
          v-if="editRerouting"
          name="spinner"
          class="h-4 w-4 shrink-0 animate-spin text-olive-900"
        />
        <span class="text-sm font-medium text-ink-900">
          {{ editRerouting ? t('edit.rerouting') : t('edit.drag') }}
        </span>
        <button
          type="button"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-cream-200"
          @click="exitEditMode(false)"
        >
          {{ t('edit.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-pill bg-olive-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-olive-800"
          @click="exitEditMode(true)"
        >
          {{ t('edit.done') }}
        </button>
      </div>
    </div>

    <!-- Erreur d'édition (toast court) -->
    <div
      v-if="editError"
      class="pointer-events-none absolute inset-x-0 top-16 z-overlay flex justify-center p-3"
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
        <div v-if="activeTab === 'settings'" key="settings" class="pt-1">
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
          <!-- Détail inline sous l'alternative sélectionnée -->
          <RouteAlternatives
            :routes="pipeline.results.value"
            :selectedId="alternativesExpandedId"
            @select="onSelectRoute"
          >
            <template #detail>
              <RouteDetail
                v-if="selectedRoute"
                :route="selectedRoute"
                :pace="pace"
                :reversed="reversed"
                @cyclePace="cyclePace"
                @toggleReverse="reversed = !reversed"
                @edit="enterEditMode"
                @hoverPoint="highlightPoint = $event"
              />
            </template>
          </RouteAlternatives>
        </div>

        <div v-else-if="activeTab === 'history'" key="history" class="pt-1">
          <!-- Détail inline sous l'entrée d'historique sélectionnée -->
          <RouteHistory
            :entries="history.list.value"
            :selectedId="viewedHistoryId"
            :pace="pace"
            @select="onSelectHistory"
            @remove="onRemoveHistory"
            @clear="onClearHistory"
          >
            <template #detail>
              <RouteDetail
                v-if="selectedRoute"
                :route="selectedRoute"
                :pace="pace"
                :reversed="reversed"
                @cyclePace="cyclePace"
                @toggleReverse="reversed = !reversed"
                @edit="enterEditMode"
                @hoverPoint="highlightPoint = $event"
              />
            </template>
          </RouteHistory>
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
        {{ t('warnings.quotaPartial') }}
      </div>
      <div
        v-if="pipeline.distanceToleranceRelaxed.value"
        class="mt-2 rounded-card bg-cream-100 px-4 py-3 text-xs text-terracotta-600"
      >
        {{ t('warnings.toleranceRelaxed') }}
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
            <Icon name="spinner" class="h-4 w-4 animate-spin" />
            {{ t('control.generating') }}
          </span>
          <span v-else class="inline-flex items-center gap-2">
            {{ t('control.generate') }}
            <Icon name="arrow-right" class="h-4 w-4" />
          </span>
        </button>
      </template>
    </component>
  </div>
</template>
