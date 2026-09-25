import { describe, expect, it } from 'vitest'
import { activeResources, backupVersion, isConcertOwnedFile, validateBackup } from './data'
import { newConcert } from './model'

describe('propietat dels fitxers d’un concert', () => {
  it('no elimina fitxers compartits de la biblioteca quan es treuen d’un concert', () => {
    const concert = newConcert()
    const band = 'b96d3a9b-7348-43d0-8054-9668854672aa'
    expect(isConcertOwnedFile(concert, `${band}/${concert.id}/document/arxiu.pdf`)).toBe(true)
    expect(isConcertOwnedFile(concert, `${band}/shared/document/arxiu.pdf`)).toBe(false)
    expect(isConcertOwnedFile(concert, `${band}/${newConcert().id}/document/arxiu.pdf`)).toBe(false)
  })
})

describe('validació de backups', () => {
  const emptyBackup = { version: backupVersion, exportedAt: '2026-09-24T10:00:00.000Z', concerts: [], library: [], money: [], merchProducts: [], merchSales: [], people: [], materials: [], setlists: [] }

  it('accepta l’estructura buida vàlida de la versió actual', () => {
    expect(validateBackup(emptyBackup)).toBe(true)
  })

  it('rebutja la versió desconeguda i registres mal formats', () => {
    expect(validateBackup({ ...emptyBackup, version: backupVersion + 1 })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchSales: [{ id: 'sale' }] })).toBe(false)
  })

  it('accepta backups antics i valida les condicions opcionals de discogràfica', () => {
    expect(validateBackup(emptyBackup)).toBe(true)
    expect(validateBackup({ ...emptyBackup, labelAgreement: { name: 'Segell', tiers: [{ above: 500, percent: 15 }] } })).toBe(true)
    expect(validateBackup({ ...emptyBackup, labelAgreement: { name: 'Segell', tiers: [{ above: 500, percent: 150 }] } })).toBe(false)
  })
})

describe('recursos actius en mode local', () => {
  it('no torna a mostrar recursos arxivats després de recarregar', () => {
    expect(activeResources([{ id: 'live', active: true }, { id: 'archived', active: false }])).toEqual([{ id: 'live', active: true }])
  })
})
