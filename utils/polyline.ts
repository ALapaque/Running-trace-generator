/**
 * Décodage du format polyline encoded de Google (utilisé par ORS).
 * Précision par défaut : 1e-5.
 *
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

export interface DecodedPoint {
  lat: number
  lng: number
  /** Présent si la polyline contient des coordonnées 3D (ORS avec elevation=true). */
  ele?: number
}

export function decodePolyline(encoded: string, precision = 5, has3d = false): DecodedPoint[] {
  const factor = 10 ** precision
  const result: DecodedPoint[] = []
  let index = 0
  let lat = 0
  let lng = 0
  let ele = 0

  while (index < encoded.length) {
    const decodeNext = (): number => {
      let byte = 0
      let shift = 0
      let value = 0
      do {
        byte = encoded.charCodeAt(index++) - 63
        value |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      return (value & 1) !== 0 ? ~(value >> 1) : value >> 1
    }

    lat += decodeNext()
    lng += decodeNext()
    if (has3d) {
      ele += decodeNext()
      result.push({ lat: lat / factor, lng: lng / factor, ele: ele / 100 })
    } else {
      result.push({ lat: lat / factor, lng: lng / factor })
    }
  }
  return result
}
