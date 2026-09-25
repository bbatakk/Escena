import { describe, expect, it } from 'vitest'
import { parseAppActions, type ActionContext } from './assistantActions'
import { newConcert } from './model'

const concert = { ...newConcert(), id: 'concert-1', title: 'La Festa' }
const context: ActionContext = {
  concerts: [concert], workspaceName: 'Banda', theme: 'live-stage',
  people: [], materials: [{ id: 'mic', name: 'Micròfon', category: 'So', active: true }], setlists: [],
  documents: [{ id: 'rider', name: 'Rider', url: '', archived: false }],
  money: [{ id: 'expense', kind: 'despesa', amount: 10, date: '2026-09-25', category: 'Transport', note: '' }],
  products: [{ id: 'shirt', name: 'Samarreta', price: 15, stock: 5, sizes: [], active: true }],
  sales: [{ id: 'sale', concertId: concert.id, productId: 'shirt', quantity: 2, unitPrice: 15, note: '' }],
}

describe('accions dels apartats', () => {
  it('prepara altes de material, documents i despeses amb els camps del seu apartat', () => {
    const actions = parseAppActions([
      { section: 'materials', mode: 'create', fields: { name: 'Pedalera', category: 'Escenari' } },
      { section: 'documents', mode: 'create', fields: { name: 'Bio', url: 'https://example.org/bio' } },
      { section: 'money', mode: 'create', fields: { kind: 'despesa', amount: 29.99, date: '2026-09-25', category: 'Gasolina' } },
    ], context)
    expect(actions).toHaveLength(3)
    expect(actions[2].after).toMatchObject({ amount: 29.99, kind: 'despesa', note: '' })
  })

  it('permet crear setlists en un pla compartit amb altres apartats', () => {
    expect(parseAppActions([{ section: 'setlists', mode: 'create', fields: { name: 'Festival', songs: ['Cançó 1'] } }, { section: 'materials', mode: 'create', fields: { name: 'Pedalera' } }], context)).toHaveLength(2)
    expect(() => parseAppActions([{ section: 'setlists', mode: 'create', fields: { name: 'Festival', songs: [] } }], context)).toThrow()
  })

  it('manté els valors visibles coherents amb els que es desaran', () => {
    expect(parseAppActions([{ section: 'money', mode: 'create', fields: { kind: 'ingres', amount: 50, date: '2026-09-25' } }], context)[0].after).toMatchObject({ category: 'Altres ingressos' })
    expect(() => parseAppActions([{ section: 'people', mode: 'create', fields: { name: 'Maria' } }], context)).toThrow()
  })

  it('previsualitza edicions/arxivats amb un registre existent i protegeix les dades adjuntes', () => {
    expect(parseAppActions([{ section: 'documents', mode: 'update', id: 'rider', fields: { name: 'Rider nou' } }], context)[0]).toMatchObject({ before: context.documents[0], after: { name: 'Rider nou' } })
    expect(parseAppActions([{ section: 'products', mode: 'archive', id: 'shirt' }], context)[0]).toMatchObject({ before: context.products[0] })
    expect(() => parseAppActions([{ section: 'people', mode: 'delete', id: 'mic' }], context)).toThrow()
  })

  it('evita duplicats, camps aliens, referències inexistents i moviments no vàlids', () => {
    expect(() => parseAppActions([{ section: 'materials', mode: 'create', fields: { name: 'MICRÒFON' } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'documents', mode: 'create', fields: { name: 'A', storagePath: 'privat' } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'money', mode: 'create', fields: { kind: 'ingres', amount: 10, date: '2026-02-30' } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'money', mode: 'create', fields: { kind: 'ingres', amount: 10, date: '2026-09-25', concertId: 'inventat' } }], context)).toThrow()
  })

  it('valida preu, estoc i talles abans de proposar una venda o editar un producte', () => {
    expect(parseAppActions([{ section: 'sales', mode: 'create', fields: { concertId: concert.id, productId: 'shirt', quantity: 3 } }], context)[0]).toMatchObject({ productPrice: 15, after: { quantity: 3 } })
    expect(() => parseAppActions([{ section: 'sales', mode: 'create', fields: { concertId: concert.id, productId: 'shirt', quantity: 4 } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'sales', mode: 'create', fields: { concertId: concert.id, productId: 'shirt', quantity: 2 } }, { section: 'sales', mode: 'create', fields: { concertId: concert.id, productId: 'shirt', quantity: 2 } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'products', mode: 'update', id: 'shirt', fields: { stock: 1 } }], context)).toThrow()
    expect(() => parseAppActions([{ section: 'products', mode: 'create', fields: { name: 'CD' } }], context)).toThrow()
  })

  it('permet reanomenar la banda però no crear un espai nou', () => {
    expect(parseAppActions([{ section: 'workspace', mode: 'update', fields: { name: 'Nova banda' } }], context)).toMatchObject([{ section: 'workspace', before: { name: 'Banda' }, after: { name: 'Nova banda' } }])
    expect(() => parseAppActions([{ section: 'workspace', mode: 'create', fields: { name: 'Nova banda' } }], context)).toThrow()
    expect(parseAppActions([{ section: 'theme', mode: 'update', fields: { theme: 'club' } }], context)).toMatchObject([{ section: 'theme', before: { theme: 'live-stage' }, after: { theme: 'club' } }])
    expect(() => parseAppActions([{ section: 'theme', mode: 'update', fields: { theme: 'vermell' } }], context)).toThrow()
  })
})
