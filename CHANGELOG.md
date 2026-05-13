# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial scaffolding of the GPX running route generator (Nuxt 3, TypeScript strict, Tailwind).
- 3-stage pipeline: ORS round-trip generation (8 parallel seeds, +10% over-request)
  → Overpass terrain analysis (R-tree spatial matching, 24h localStorage cache,
  3 parallel requests max, kumi.systems fallback) → weighted scoring (top 3).
- Path-type classification (`route` / `chemin_large` / `single` / `unknown`)
  from `highway`, `surface`, `tracktype`, `width` tags.
- Forest detection via `@turf/boolean-point-in-polygon` over `landuse=forest`
  and `natural=wood` polygons.
- Leaflet map with polyline coloured per path type.
- Elevation profile (native SVG).
- Terrain breakdown bar chart.
- GPX 1.1 export with `<ele>` (Komoot-compatible) and no `<time>` on `<trkpt>`
  (Strava-compatible).
- Geocoding via Nominatim.
- 34 Vitest unit tests covering `geo`, `scoring`, `spatial-matching`, `gpx-builder`.
- Example GPX file under `examples/`.
