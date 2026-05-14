# RunGen — Générateur de traces de running GPX

Web app monopage (Nuxt 3 + TypeScript) qui génère des **boucles de running** (round-trip) personnalisées à partir d'un point de départ, et les exporte en **GPX** compatible Strava et Komoot.

100 % côté client. Aucun backend, aucun service à héberger.

---

## Fonctionnalités

- **Point de départ** : clic sur la carte, recherche d'adresse (Nominatim) ou géolocalisation (« ma position »).
- **Plages min–max** pour la distance (3–50 km) et le dénivelé positif (0–2000 m) — chacune **optionnelle**, au moins une active. Permet « entre X et Y km peu importe le D+ » et inversement.
- Type de chemin : `route`, `chemin_large`, `single`, `mixte`.
- Toggle **« privilégier la forêt »** (`landuse=forest` / `natural=wood`).
- Type de côte : `plat`, `vallonné`, `montagneux`.
- Nombre d'alternatives configurable : **3 / 5 / 10**.
- Polyline **colorée par type de chemin**, **dessinée progressivement** sur la carte.
- Statistiques animées : distance, D+, D-, **temps estimé** (allure réglable), **difficulté calculée**.
- Profil altimétrique (SVG natif, tracé animé).
- **Répartition % route / chemin / single / forêt** (bar chart).
- **Inversion du sens** et **édition manuelle du tracé** (waypoints déplaçables → re-routage).
- **Historique** des parcours générés (localStorage) et **partage par URL** (paramètres dans le hash).
- Export **GPX 1.1**, ou envoi vers **Komoot / Strava** via la Web Share API.
- **PWA** installable — consultation hors-ligne d'un parcours déjà chargé.
- Layout responsive : **bottom sheet** sur mobile, **sidebar flottante draggable** sur desktop.
- Indicateur de chargement à deux étages : *Génération du parcours…* puis *Analyse du terrain…*

---

## Stack

| Couche             | Outil                                                |
| ------------------ | ---------------------------------------------------- |
| Framework          | Nuxt 3 + TypeScript strict                           |
| Style              | Tailwind CSS                                         |
| Carte              | Leaflet + tuiles CartoDB Voyager (données OSM)       |
| Routing & élév.    | OpenRouteService (`foot-hiking`, round-trip)         |
| Tags OSM           | Overpass API (`overpass-api.de` + miroir `kumi`)     |
| Géocodage          | Nominatim (OSM)                                      |
| Spatial            | `rbush` (R-tree) + `@turf/boolean-point-in-polygon`  |
| Validation         | Valibot                                              |
| Tests / CI         | Vitest + GitHub Actions                              |

---

## Installation

```bash
pnpm install   # ou npm install / yarn install
cp .env.example .env
# Éditer .env et y coller la clé ORS
pnpm dev
```

### Obtenir une clé OpenRouteService (gratuit)

1. Aller sur <https://openrouteservice.org/dev/#/signup>
2. Créer un compte (email seul nécessaire).
3. Dans le dashboard, créer un token. Le tier gratuit donne accès à :
   - **2000 requêtes / jour**
   - **40 requêtes / minute**
4. Copier la clé dans `.env` :

```
NUXT_PUBLIC_ORS_API_KEY=eyJvcmciOiI1Yj...
```

> ⚠️ La clé est exposée côté client (c'est inhérent à une app sans backend).
> Si quelqu'un récupère ta clé, il consomme ton quota.

### Proxy ORS (optionnel — masque la clé)

Pour un déploiement public, un **proxy serverless opt-in** masque la clé ORS.
Il est **inerte par défaut** (l'app reste « zéro backend »). Pour l'activer :

1. Définir la clé **côté serveur** : `NUXT_ORS_API_KEY=...` (sans `PUBLIC_`).
2. Pointer le client vers le proxy : `NUXT_PUBLIC_ORS_BASE_URL=/api/ors`.
3. Ne pas définir `NUXT_PUBLIC_ORS_API_KEY` (la clé ne transite plus côté client).

La route `server/api/ors/[...path].post.ts` relaie alors les appels vers ORS
en injectant la clé serveur. Sur Vercel, c'est une fonction serverless du
free tier. Sans ces variables, la route renvoie 503 et n'est jamais appelée.

### Progressive Web App

L'app est installable (manifest + service worker `public/sw.js`) : app shell
et tuiles de carte mises en cache → consultation hors-ligne d'un parcours déjà
chargé. Les appels API (ORS / Overpass / Nominatim) restent en réseau direct.

---

## Architecture

```
/composables
  useRouteGenerator.ts      # appels ORS (round-trip + routage par waypoints)
  useTerrainAnalyzer.ts     # Overpass + R-tree + point-in-polygon + circuit breaker
  useScoring.ts             # ranking des candidats (rangeError, concentration D+)
  useRoutePipeline.ts       # orchestration génération → analyse → scoring
  useGpxExport.ts           # décimation + GPX + download / Web Share
  useElevationProfile.ts    # série pour le profil SVG
  useGeocoding.ts           # recherche Nominatim
  useGeolocation.ts         # navigator.geolocation (« ma position »)
  useRouteHistory.ts        # historique localStorage des parcours
  useLocalStorage.ts        # ref synchronisée localStorage
  useMediaQuery.ts          # bascule responsive mobile/desktop
  useRunnerPace.ts          # allure de course persistée
  useCountUp.ts             # animation de nombres (count-up)
  useRouteFormSchema.ts     # validation Valibot du formulaire
/components
  MapView.vue               # Leaflet, polyline animée colorée par type, édition
  ControlPanel.vue          # formulaire (plages, terrain, côtes, alternatives)
  RangeSlider.vue           # slider à deux poignées (plage min–max)
  BottomSheet.vue           # bottom sheet draggable mobile (snap points)
  FloatingPanel.vue         # sidebar flottante draggable desktop
  SheetTabs.vue             # barre d'onglets (scrollable)
  FloatingButton.vue        # FAB circulaire
  ExportMenu.vue            # menu Komoot / Strava / GPX
  RouteStats.vue            # distance / D+ / D- / temps (count-up)
  ElevationChart.vue        # profil SVG natif (tracé animé)
  TerrainBreakdown.vue      # bar chart répartition terrain
  RouteAlternatives.vue     # liste des alternatives
  RouteHistory.vue          # liste de l'historique
  LoadingOverlay.vue        # indicateur de chargement
/utils
  overpass-query-builder.ts # Overpass QL templating
  spatial-matching.ts       # rbush + classification + lissage PathType
  gpx-builder.ts            # XML GPX 1.1
  bbox-cache.ts             # cache Overpass localStorage TTL 24h
  storage.ts                # accès localStorage sûr (JSON, SSR-safe)
  share-url.ts              # encode/décode des paramètres dans le hash
  geo.ts                    # haversine, bbox, décimation
  climbs.ts                 # détection des montées + concentration D+
  route-ops.ts              # transformations (inversion de sens)
  difficulty.ts             # difficulté estimée (kilomètre-effort)
  pace.ts                   # allure : presets, formatage, cycle
  fetch-timeout.ts          # fetch avec timeout dur
  concurrency.ts            # limiteur de concurrence (Overpass 3 req max)
  polyline.ts               # décodeur polyline Google (au cas où)
/server/api/ors
  [...path].post.ts         # proxy ORS opt-in (inerte par défaut)
/types
  ors.ts, osm.ts, gpx.ts, index.ts
/pages
  index.vue                 # page unique
/plugins
  pwa.client.ts             # enregistrement du service worker
/public
  manifest.webmanifest, sw.js, icon.svg
/tests                      # 94 tests Vitest
/.github/workflows/ci.yml   # typecheck + tests + build sur chaque PR
/examples
  example-10km-flat.gpx
config.ts                   # pondérations, seuils, couleurs
```

---

## Algorithme

### Étage 1 — Génération (ORS)

- **N appels parallèles** à `POST /v2/directions/foot-hiking/geojson`, avec
  `N = max(8, alternatives + 3)` — soit 8 / 8 / 13 pour 3 / 5 / 10 alternatives.
- `options.round_trip` avec `length`, `points: 5`, `seed` différents.
- Les **longueurs cibles sont réparties sur la plage de distance** demandée
  (ou un span d'exploration 5–25 km si la distance n'est pas contrainte).
- `elevation: true` pour récupérer le profil altimétrique SRTM.
- Ratio de demande **neutre (1.0)** — le filtre de plage de l'étage 3 écarte
  les écarts ; pas de sur-demande systématique.
- **Timeout dur** par requête ; les erreurs individuelles (429, 5xx, timeout)
  n'invalident pas l'ensemble : on garde les succès.

### Étage 2 — Analyse de terrain (Overpass)

Pour chaque candidat :

1. **Décimation** de la polyline à ~1 point / 50 m.
2. Construction du **bounding box** englobant avec marge 30 m.
3. **Cache localStorage** : la bbox est arrondie à 0.01° et sert de clé, TTL 24 h.
4. Une seule requête Overpass par candidat (3 en parallèle max, **timeout dur**,
   fallback miroir `kumi.systems`) :

   ```overpassql
   [out:json][timeout:25];
   (
     way["highway"~"path|track|footway|bridleway|cycleway|residential|tertiary|secondary|..."](bbox);
     way["landuse"="forest"](bbox);
     way["natural"="wood"](bbox);
   );
   out geom;
   ```
5. **Circuit breaker** : après 2 échecs Overpass consécutifs, les candidats
   restants passent en fast-fallback (sans appel réseau) pendant 60 s.
6. Construction d'un **R-tree (rbush)** sur les segments de ways.
7. Pour chaque point décimé, recherche du segment OSM le plus proche (< 15 m),
   classification en `route | chemin_large | single | unknown`.
8. **Lissage** de la séquence de types (filtre de mode glissant) — efface les
   classifications isolées aberrantes aux intersections.
9. Détection forêt par ray-casting sur les polygones `landuse=forest` / `natural=wood`.

### Étage 3 — Scoring

```
score =
    w_dist     * rangeError(distance, plage_distance)
  + w_dplus    * rangeError(dplus, plage_dplus)
  + w_chemin   * (1 - % du type de chemin demandé)
  + w_foret    * (1 - % forêt)              [si toggle activé]
  + w_profile  * pénalité_shape(type_de_côte)
```

`rangeError(valeur, plage)` vaut **0 si la valeur est dans la plage**, sinon
l'écart au bord le plus proche normalisé. Si un critère n'est pas contraint
(`plage = null`), sa composante est **neutralisée**. Idem pour la composante
terrain quand Overpass a échoué (mode fallback).

Pondérations par défaut (dans `config.ts`) :

| Poids       | Valeur |
| ----------- | ------ |
| `w_dist`    | 0.25   |
| `w_dplus`   | 0.25   |
| `w_chemin`  | 0.25   |
| `w_foret`   | 0.15   |
| `w_profile` | 0.10   |

La **concentration du D+** est la part du D+ contenue dans la plus grosse
montée réelle (`utils/climbs.ts` segmente le tracé en montées). Elle discrimine
`plat`, `vallonné` (plusieurs montées → concentration basse) et `montagneux`
(une grosse montée → concentration ≈ 1).

**Lissage du D+** : variations < 2 m ignorées (bruit SRTM).

Avant scoring, un **filtre de plage** écarte les candidats dont la distance
et/ou le D+ tombent hors des plages demandées (élargies d'une tolérance) ;
si trop peu de candidats passent, le filtre est relâché. Plus le score est
bas, mieux c'est — les **N meilleurs** sont retournés.

---

## Fallbacks et limites

| Problème                              | Comportement                                                    |
| ------------------------------------- | --------------------------------------------------------------- |
| Quota ORS dépassé (429 sur tous)      | Message d'erreur explicite, aucun résultat.                     |
| Quelques 429 ORS                       | Warning affiché, les candidats restants sont utilisés.          |
| Overpass timeout / 429 (primaire)      | Bascule automatique sur `overpass.kumi.systems`.                |
| Overpass KO sur les deux miroirs       | Candidat conservé, terrain marqué `fallback`, scoring distance/D+ uniquement. |
| Aucun way OSM matché (< 15 m) sur un point | Segment classé `unknown`.                                  |
| Quota localStorage saturé              | Les entrées de cache les plus vieilles sont purgées.           |

### Matching ORS ↔ OSM

ORS utilise les données OSM mais ne renvoie pas les `way_id`. Le matching spatial
par proximité (< 15 m) est donc nécessaire. C'est imparfait aux intersections —
accepter **~5–10 % d'erreur de classification**.

### Décimation GPX

Pour 50 km, ORS renvoie 5000+ points. On décime à 1 point / 10 m avant export GPX
(Komoot limite à 10 000 points).

### Conformité Strava / Komoot

- `<ele>` est inclus sur chaque `<trkpt>` (obligatoire pour Komoot).
- **Pas de `<time>` sur les `<trkpt>`** (sinon Strava interprète comme une activité).

---

## Limites du free tier ORS

| Limite           | Valeur            |
| ---------------- | ----------------- |
| Requêtes / jour  | 2000              |
| Requêtes / min   | 40                |
| Distance max     | ~6000 km / requête |
| Latence typique  | 200 ms – 2 s      |

Chaque génération consomme `max(8, alternatives + 3)` requêtes ORS (8 pour
3–5 alternatives, 13 pour 10) + 1 requête par re-routage en édition manuelle.
Soit **~150 à 250 générations / jour** selon le réglage. Le quota est partagé
entre tous les visiteurs d'un déploiement public.

---

## Respect des fair-use Overpass

- **Max 3 requêtes parallèles** côté client (limiteur dans `utils/concurrency.ts`).
- **Cache localStorage 24 h** par bbox arrondie à 0.01°.
- **Fallback automatique** sur `overpass.kumi.systems` en cas de 429/504.
- Pas de retry agressif : 1 essai, puis fallback, puis abandon (mode terrain non analysé).

---

## Scripts

```bash
pnpm dev          # lancer en dev (HMR)
pnpm build        # build prod
pnpm preview      # preview du build
pnpm test         # exécuter Vitest une fois
pnpm test:watch   # mode watch
pnpm typecheck    # vue-tsc strict
```

---

## Licence

MIT.

Tiles : © OpenStreetMap contributors.
Données : © OpenStreetMap, ODbL.
Élévation : SRTM (NASA, domaine public).
