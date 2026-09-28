import { describe, expect, it } from 'vitest'
import { defaultPosterDesign, posterColumns, posterMetrics, posterPageSize, type PosterDesign } from './poster'

describe('columnes del cartell de gira', () => {
  const design = (changes: Partial<PosterDesign>): PosterDesign => ({ ...defaultPosterDesign, ...changes })

  it('manté el nombre de columnes triat dins del rang permès', () => {
    expect([1, 2, 3, 4].map((columns) => posterColumns(design({ columns })))).toEqual([1, 2, 3, 4])
    expect([0, 5, 2.4].map((columns) => posterColumns(design({ columns })))).toEqual([1, 1, 2])
  })

  it('recupera les columnes de dissenys desats sense la opció nova', () => {
    expect(posterColumns(design({ layout: 'quadrícula', columns: Number.NaN }))).toBe(2)
    expect(posterColumns(design({ layout: 'cartell', columns: Number.NaN }))).toBe(1)
    expect(posterColumns(design({ layout: 'columna', columns: Number.NaN }))).toBe(1)
  })

  it('hi capen més dates per pàgina quan hi ha més columnes', () => {
    const single = posterPageSize(design({ columns: 1 }))
    expect(posterPageSize(design({ columns: 2 }))).toBe(single * 2)
    expect(posterPageSize(design({ columns: 3 }))).toBe(single * 3)
    expect(single).toBeGreaterThan(0)
  })
})

describe('mètriques del cartell de gira', () => {
  const design = (changes: Partial<PosterDesign>): PosterDesign => ({ ...defaultPosterDesign, ...changes })

  it('reparteix les files en columnes que caben dins del marge', () => {
    const metrics = posterMetrics(design({ columns: 3, columnGap: 30, margin: 90 }))
    expect(metrics.columnWidth).toBeCloseTo((900 - 60) / 3)
    expect(metrics.left).toBe(90)
    expect(metrics.right).toBe(990)
    expect(metrics.contentWidth).toBe(900)
    expect(metrics.left + 2 * (metrics.columnWidth + metrics.columnGap) + metrics.columnWidth).toBeCloseTo(metrics.right)
  })

  it('encabem les files dins de l’alçada disponible entre capçalera i peu', () => {
    const metrics = posterMetrics(design({ showTitle: false, showSubtitle: false, showBand: false, showFooter: false, rules: false }))
    expect(metrics.rowTop).toBe(90)
    expect(metrics.rowTop + metrics.rows * metrics.rowHeight).toBeLessThanOrEqual(metrics.height - 90)
  })

  it('dona més files quan la capçalera o el peu són més petits', () => {
    const full = posterPageSize(design({}))
    const bare = posterPageSize(design({ showTitle: false, showSubtitle: false, showBand: false, showFooter: false, rules: false }))
    expect(bare).toBeGreaterThan(full)
  })

  it('els blocs deixen les files més altes que les línies', () => {
    expect(posterMetrics(design({ divider: 'block' })).rowHeight).toBeGreaterThan(posterMetrics(design({ divider: 'line' })).rowHeight)
    expect(posterMetrics(design({ divider: 'line' })).rowHeight).toBe(posterMetrics(design({ divider: 'none' })).rowHeight)
  })

  it('aguanta valors fora de rang sense trencar la maquetació', () => {
    const metrics = posterMetrics(design({ margin: 5, columnGap: 400, fontSize: 400, spacing: -20, titleSize: 900 }))
    expect(metrics.left).toBe(40)
    expect(metrics.columnGap).toBe(48)
    expect(metrics.rows).toBeGreaterThanOrEqual(1)
  })
})
