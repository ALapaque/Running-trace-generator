import { describe, expect, it } from 'vitest'
import { buildGpx } from '../utils/gpx-builder'

describe('buildGpx', () => {
  it('produit un GPX 1.1 valide avec <ele>', () => {
    const gpx = buildGpx(
      [
        { lat: 50.8503, lng: 4.3517, ele: 56.2 },
        { lat: 50.8513, lng: 4.3527, ele: 58.4 },
      ],
      { time: '2026-05-13T10:00:00.000Z', trackName: 'Test', metadataName: 'Meta' },
    )

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(gpx).toContain('<gpx version="1.1"')
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"')
    expect(gpx).toContain('<name>Meta</name>')
    expect(gpx).toContain('<time>2026-05-13T10:00:00.000Z</time>')
    expect(gpx).toContain('<trk>')
    expect(gpx).toContain('<name>Test</name>')
    expect(gpx).toContain('<trkpt lat="50.850300" lon="4.351700">')
    expect(gpx).toContain('<ele>56.2</ele>')
  })

  it("n'inclut PAS de <time> sur les trkpt (compatibilité Strava)", () => {
    const gpx = buildGpx([{ lat: 0, lng: 0, ele: 10 }])
    // Le seul <time> doit être dans le bloc metadata
    const matches = gpx.match(/<time>/g) ?? []
    expect(matches).toHaveLength(1)
    // Et il ne doit pas y avoir de <time> à l'intérieur d'un <trkpt>
    expect(/<trkpt[^>]*>[^<]*<time>/.test(gpx)).toBe(false)
  })

  it('échappe les caractères XML dangereux', () => {
    const gpx = buildGpx([{ lat: 0, lng: 0 }], { trackName: 'Foo & <bar>' })
    expect(gpx).toContain('Foo &amp; &lt;bar&gt;')
    expect(gpx).not.toContain('Foo & <bar>')
  })

  it("omet la balise <ele> si l'altitude est absente ou invalide", () => {
    const gpx = buildGpx([{ lat: 0, lng: 0 }])
    expect(gpx).not.toContain('<ele>')
  })

  it('utilise 6 décimales pour les coordonnées', () => {
    const gpx = buildGpx([{ lat: 50.123456789, lng: 4.987654321, ele: 100 }])
    expect(gpx).toContain('lat="50.123457"')
    expect(gpx).toContain('lon="4.987654"')
  })
})
