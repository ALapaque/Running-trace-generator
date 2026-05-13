/**
 * Construction de requêtes Overpass QL pour récupérer les ways et zones forestières
 * couvrant la bbox d'un parcours.
 */

import type { BBox } from '../types/osm'

/** Catégories `highway` qu'on essaye de matcher avec le tracé ORS. */
export const HIGHWAY_REGEX =
  'path|track|footway|bridleway|cycleway|residential|tertiary|secondary|unclassified|service|pedestrian|living_street|primary'

/**
 * Génère la requête Overpass QL pour une bbox donnée.
 * Une seule requête couvre highways, surfaces forestières (landuse=forest, natural=wood).
 */
export function buildOverpassQuery(bbox: BBox, timeoutS = 25): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  return `[out:json][timeout:${timeoutS}];
(
  way["highway"~"${HIGHWAY_REGEX}"](${bboxStr});
  way["landuse"="forest"](${bboxStr});
  way["natural"="wood"](${bboxStr});
);
out geom;`
}
