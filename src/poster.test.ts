import { describe, expect, it } from 'vitest'
import { defaultPosterDesign, normalizePosterDesign, parsePosterTemplates, posterAssistantContext, posterColumns, posterMetrics, posterPageSize, type PosterDesign } from './poster'
import { newConcert } from './model'

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

describe('plantilles del cartell', () => {
  it('normalitza plantilles desades i ignora entrades invàlides', () => {
    const raw = JSON.stringify([
      { id: 'one', name: '  Festa  ', design: { ...defaultPosterDesign, columns: 3, title: 'Nit especial' } },
      { id: 'bad', name: '   ', design: defaultPosterDesign },
      { id: 'missing', name: 'Sense disseny' },
      null,
    ])
    expect(parsePosterTemplates(raw)).toEqual([{ id: 'one', name: 'Festa', design: { ...defaultPosterDesign, columns: 3, title: 'Nit especial' } }])
  })

  it('retorna una llista buida si l’emmagatzematge és buit o invàlid', () => {
    expect(parsePosterTemplates(null)).toEqual([])
    expect(parsePosterTemplates('això no és JSON')).toEqual([])
    expect(parsePosterTemplates(JSON.stringify({ id: 'one' }))).toEqual([])
  })

  it('limita les dades recuperades a 30 plantilles i saneja el disseny', () => {
    const many = Array.from({ length: 35 }, (_, index) => ({ id: String(index), name: `P${index}`, design: { columns: 20, background: 'invalid' } }))
    const parsed = parsePosterTemplates(JSON.stringify(many))
    expect(parsed).toHaveLength(30)
    expect(parsed[0].design.columns).toBe(1)
    expect(parsed[0].design.background).toBe(defaultPosterDesign.background)
  })

  it('normalitza un disseny antic sense perdre els camps amb valors vàlids', () => {
    expect(normalizePosterDesign({ layout: 'quadrícula', title: 'Gira!', columns: 2 })).toMatchObject({ layout: 'quadrícula', divider: 'block', title: 'Gira!', columns: 2 })
    expect(normalizePosterDesign(null)).toEqual(defaultPosterDesign)
  })
})

describe('context del cartell per a l’assistent', () => {
  it('projecta les dates tal com es publiquen i no revela concerts sense permís', () => {
    const visible = { ...newConcert(), id: 'visible', title: 'Festa Major', date: '2026-10-12', status: 'confirmat' as const, city: 'Reus', details: { ...newConcert().details, announceable: true } }
    const hidden = { ...newConcert(), id: 'hidden', title: 'Acte privat', date: '2026-10-13', status: 'confirmat' as const, city: 'Tarragona' }
    const result = posterAssistantContext([visible, hidden], '2026-10-01', JSON.stringify({ ...defaultPosterDesign, columns: 2 }), JSON.stringify([{ id: 'summer', name: 'Estiu', design: defaultPosterDesign }]), true)
    expect(result).toMatchObject({ pageSize: expect.any(Number), pageCount: 1, hiddenDateCount: 1, logoAvailable: true, backgroundImageIncluded: false, templates: [{ name: 'Estiu' }] })
    expect(result.dates).toEqual([
      { date: '2026-10-12', name: 'Festa Major', city: 'Reus', hidden: false, past: false },
      { date: '2026-10-13', name: 'Per anunciar', hidden: true, past: false },
    ])
    expect(JSON.stringify(result)).not.toContain('Acte privat')
    expect(JSON.stringify(result)).not.toContain('Tarragona')
  })

  it('respecta les opcions que amaguen concerts passats, dates, noms i poblacions', () => {
    const concert = { ...newConcert(), id: 'past', title: 'Concert passat', date: '2026-09-01', status: 'realitzat' as const, city: 'Girona', details: { ...newConcert().details, announceable: true } }
    const hiddenPast = posterAssistantContext([concert], '2026-10-01', JSON.stringify({ ...defaultPosterDesign, showPast: false }), null, false)
    expect(hiddenPast.dates).toEqual([])
    expect(hiddenPast.excludedPastCount).toBe(1)
    const noFields = posterAssistantContext([concert], '2026-08-01', JSON.stringify({ ...defaultPosterDesign, showDate: false, showName: false, showCity: false }), null, false)
    expect(noFields.dates).toEqual([{ hidden: false, past: false }])
  })
})
