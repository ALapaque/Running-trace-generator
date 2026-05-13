# RunGen — Générateur de traces de running GPX

Web app monopage (Nuxt 3 + TypeScript) qui génère des **boucles de running** (round-trip) personnalisées à partir d'un point de départ, et les exporte en **GPX** compatible Strava et Komoot.

100 % côté client. Aucun backend, aucun service à héberger.

---

## Fonctionnalités

- Point de départ par **clic carte** ou **recherche d'adresse** (Nominatim).
- Distance cible **3–50 km** (pas de 0.5).
- Dénivelé positif cible **0–2000 m** (pas de 50).
- Type de chemin : `route`, `chemin_large`, `single`, `mixte`.
- Toggle **« privilégier la forêt »** (`landuse=forest` / `natural=wood`).
- Type de côte : `plat`, `vallonné`, `montagneux`.
- 8 candidats générés en parallèle, **top 3** présenté à l'utilisateur.
- Polyline colorée par type de chemin (route / chemin large / single).
- Statistiques : distance, D+, D-, temps estimé (6 min/km).
- Profil altimétrique (SVG natif).
- **Répartition % route / chemin / single / forêt** (mini bar chart).
- Export **GPX 1.1** (téléchargement client direct).
- Indicateur de chargement à deux étages : *Génération du parcours…* puis *Analyse du terrain…*

---

## Stack

| Couche             | Outil                                                |
| ------------------ | ---------------------------------------------------- |
| Framework          | Nuxt 3 + TypeScript strict                           |
| Style              | Tailwind CSS                                         |
| Carte              | Leaflet + OpenStreetMap tiles                        |
| Routing & élév.    | OpenRouteService (`foot-hiking`, round-trip)         |
| Tags OSM           | Overpass API (`overpass-api.de` + miroir `kumi`)     |
| Géocodage          | Nominatim (OSM)                                      |
| Spatial            | `rbush` (R-tree) + `@turf/boolean-point-in-polygon`  |
| Validation         | Valibot                                              |
| Tests              | Vitest                                               |

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
> Si quelqu'un récupère ta clé, il consomme ton quota. Pour un déploiement public,
> envisage de proxy via Cloudflare Workers ou similaire.

---

## Architecture

```
/composables
  useRouteGenerator.ts      # appels ORS, 8 seeds en parallèle, sur-demande +10%
  useTerrainAnalyzer.ts     # Overpass + R-tree + point-in-polygon (forêt)
  useScoring.ts             # ranking des candidats
  useGpxExport.ts           # décimation + buildGpx + download
  useElevationProfile.ts    # série pour le profil SVG
  useGeocoding.ts           # recherche Nominatim
  useRoutePipeline.ts       # orchestration des 3 étages
  useRouteFormSchema.ts     # validation Valibot
/components
  MapView.vue               # Leaflet, polyline colorée par type
  ControlPanel.vue          # tous les inputs
  ElevationChart.vue        # SVG natif (pas de Chart.js → bundle léger)
  TerrainBreakdown.vue      # bar chart répartition
  RouteStats.vue            # distance / D+ / D- / temps
  RouteAlternatives.vue     # top 3
  LoadingOverlay.vue        # indicateur 2 étages
/utils
  overpass-query-builder.ts # Overpass QL templating
  spatial-matching.ts       # rbush + classification PathType
  gpx-builder.ts            # XML GPX 1.1
  bbox-cache.ts             # localStorage TTL 24h
  polyline.ts               # décodeur polyline Google (au cas où)
  geo.ts                    # haversine, bbox, décimation
  concurrency.ts            # limiteur de concurrence (Overpass 3 req max)
/types
  ors.ts, osm.ts, gpx.ts, index.ts
/pages
  index.vue                 # page unique
/tests
  scoring.test.ts
  spatial-matching.test.ts
  gpx-builder.test.ts
  geo.test.ts
/examples
  example-10km-flat.gpx
config.ts                   # pondérations, seuils, couleurs
```

---

## Algorithme

### Étage 1 — Génération (ORS)

- 8 appels parallèles à `POST /v2/directions/foot-hiking/geojson`
- `options.round_trip` avec `length`, `points: 5`, `seed` différents.
- `elevation: true` pour récupérer le profil altimétrique SRTM.
- **Sur-demande +10 %** sur `length` (ORS sous-livre fréquemment).
- Les erreurs individuelles (429, 5xx) n'invalident pas l'ensemble : on garde les succès.

### Étage 2 — Analyse de terrain (Overpass)

Pour chaque candidat :

1. **Décimation** de la polyline à ~1 point / 50 m.
2. Construction du **bounding box** englobant avec marge 30 m.
3. **Cache localStorage** : la bbox est arrondie à 0.01° et sert de clé, TTL 24 h.
4. Une seule requête Overpass par candidat (3 en parallèle max, fair-use) :

   ```overpassql
   [out:json][timeout:25];
   (
     way["highway"~"path|track|footway|bridleway|cycleway|residential|tertiary|secondary|..."](bbox);
     way["landuse"="forest"](bbox);
     way["natural"="wood"](bbox);
   );
   out geom;
   ```
5. Construction d'un **R-tree (rbush)** sur les segments de ways.
6. Pour chaque point décimé, recherche du segment OSM le plus proche (< 15 m).
7. Classification du way en `route | chemin_large | single | unknown` à partir de `highway`, `surface`, `tracktype`, `width`.
8. Détection forêt par ray-casting (`@turf/boolean-point-in-polygon`) sur les polygones `landuse=forest` / `natural=wood`.

### Étage 3 — Scoring

```
score =
    w_dist     * |distance_real - distance_cible| / distance_cible
  + w_dplus    * |dplus - dplus_cible| / max(dplus_cible, 1)
  + w_chemin   * (1 - % du type de chemin demandé)
  + w_foret    * (1 - % forêt)              [si toggle activé]
  + w_profile  * pénalité_shape(type_de_côte)
```

Pondérations par défaut (dans `config.ts`) :

| Poids       | Valeur |
| ----------- | ------ |
| `w_dist`    | 0.25   |
| `w_dplus`   | 0.25   |
| `w_chemin`  | 0.25   |
| `w_foret`   | 0.15   |
| `w_profile` | 0.10   |

La **concentration du D+** est calculée comme le coefficient de variation des gains
par tronçon (le tracé est découpé en 10 tronçons de longueur égale). Cette concentration
permet de discriminer `plat` (D+ faible et régulier), `vallonné` (montées courtes répétées,
concentration moyenne) et `montagneux` (D+ concentré, concentration élevée).

**Lissage du D+** : variations < 2 m ignorées (bruit SRTM).

Plus le score est bas, mieux c'est. Top 3 retourné.

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

Avec 8 candidats par génération, **un utilisateur peut faire ~250 essais / jour**.
Lance le moins de générations possibles : chaque ajustement de paramètre = 8 requêtes.

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
