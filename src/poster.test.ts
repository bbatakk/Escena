import { describe, expect, it } from 'vitest'
import { defaultPosterDesign, posterColumns, posterPageSize, type PosterDesign } from './poster'

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
