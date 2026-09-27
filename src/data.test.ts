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
    expect(validateBackup({ ...emptyBackup, money: [{ id: 'movement', kind: 'ingres', amount: -1, date: '2026-09-24' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ id: 'product', name: 'Samarreta', price: 10, stock: 3, sizes: [{ name: 'M', stock: -1 }] }] })).toBe(false)
  })

  it('valida l’estructura dels concerts abans de mostrar-ne la previsualització', () => {
    const concert = { ...newConcert(), date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, concerts: [concert] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, documents: [{ id: 'doc', name: 'Rider', url: '', direction: 'executar', status: 'pendent' }] } }] })).toBe(false)
  })

  it('continua acceptant backups antics amb camps afegits en versions posteriors', () => {
    const concert = { ...newConcert(), date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, concerts: [concert], library: [{ id: 'doc', name: 'Rider', url: '' }], money: [{ id: 'movement', kind: 'ingres', amount: 10, date: '2026-10-05' }], merchProducts: [{ id: 'product', name: 'CD', price: 10, stock: 5 }], merchSales: [{ id: 'sale', concertId: concert.id, productId: 'product', quantity: 1, unitPrice: 10 }], people: [{ id: 'person', name: 'Músic' }], materials: [{ id: 'material', name: 'Micròfon' }], setlists: [{ id: 'setlist', name: 'Festival', songs: ['Tema'] }] })).toBe(true)
  })

  it('valida el compte associat als moviments de tresoreria', () => {
    const movement = { id: 'movement', kind: 'ingres', amount: 10, date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'bank' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'cash' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'card' }] })).toBe(false)
  })

  it('accepta imatges optimitzades del catàleg als backups locals i rebutja URL externes com a imatge', () => {
    const product = { id: 'shirt', name: 'Samarreta', price: 20, stock: 4, active: true }
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageDataUrl: 'data:image/webp;base64,UklGRg==' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageDataUrl: 'https://example.com/image.webp' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageUrl: 'https://project.supabase.co/storage/v1/object/sign/...' }] })).toBe(false)
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
